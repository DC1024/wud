import axios, { AxiosRequestConfig } from 'axios';
import DockerRegistryV2 from '../../DockerRegistryV2';
import { ContainerImage } from '../../../model/container';

/**
 * Alibaba Cloud Container Registry (ACR / Aliyun) integration.
 *
 * ACR requires a Bearer token for every registry API call, and the token
 * endpoint is advertised by the registry itself through the `WWW-Authenticate`
 * header, e.g.
 *
 *   Bearer realm="https://dockerauth.cn-hangzhou.aliyuncs.com/auth",
 *          service="registry.aliyuncs.com:cn-hangzhou:26842"
 *
 * The generic `DockerRegistryV2` implementation only sends Basic credentials
 * when they are configured, and sends no `Authorization` header at all
 * otherwise. That makes public repositories unusable: every call answers 401
 * ("Request failed with status code 401") even though `docker pull` works
 * anonymously, because the Docker CLI performs the Bearer handshake below.
 *
 * This provider therefore implements the standard Bearer flow:
 *   1. probe `<registry api base>/` and read the `WWW-Authenticate` challenge
 *   2. request a token from the advertised realm (Basic credentials are sent
 *      too when configured, which keeps private repositories working)
 *   3. replay the original request with `Authorization: Bearer <token>`
 *
 * Any failure degrades to the previous behaviour instead of throwing, so a
 * registry that does not advertise a realm keeps working as before.
 */
class Alibaba extends DockerRegistryV2 {
    protected registryPattern = /^.*\.?aliyuncs\.com$/;

    /** Cached `WWW-Authenticate` challenge (realm + service) of the registry. */
    private authChallenge?: { realm: string; service: string };

    getConfigurationSchema() {
        return this.joi.alternatives([
            this.joi.string().allow(''),
            this.joi.object().keys({
                username: this.joi.string(),
                password: this.joi.string(),
                token: this.joi.string(),
                auth: this.joi.string(),
            }),
        ]);
    }

    /**
     * Registry API base (e.g. `https://registry.cn-hangzhou.aliyuncs.com/v2`).
     */
    private getRegistryApiBase(image: ContainerImage): string {
        const url =
            (this.configuration && this.configuration.url) ||
            (image.registry && image.registry.url) ||
            '';
        return String(url).replace(/\/+$/, '');
    }

    /**
     * Read the Bearer challenge advertised by the registry (`/v2/`).
     */
    private async getAuthChallenge(
        image: ContainerImage,
    ): Promise<{ realm: string; service: string }> {
        if (this.authChallenge) {
            return this.authChallenge;
        }
        const probeUrl = `${this.getRegistryApiBase(image)}/`;
        const response = await axios({
            method: 'GET',
            url: probeUrl,
            // 401 is the expected answer: it carries the WWW-Authenticate header.
            validateStatus: () => true,
        });
        const header = String(response.headers['www-authenticate'] || '');
        const realmMatch = /realm="([^"]+)"/.exec(header);
        const serviceMatch = /service="([^"]+)"/.exec(header);
        if (!realmMatch) {
            throw new Error(
                `No Bearer realm advertised by ${probeUrl} (www-authenticate: ${
                    header || 'none'
                })`,
            );
        }
        this.authChallenge = {
            realm: realmMatch[1],
            service: serviceMatch ? serviceMatch[1] : '',
        };
        return this.authChallenge;
    }

    async authenticate(
        image: ContainerImage,
        requestOptions: AxiosRequestConfig,
    ): Promise<AxiosRequestConfig> {
        const credentials = this.getAuthCredentials();
        try {
            const challenge = await this.getAuthChallenge(image);
            const separator = challenge.realm.includes('?') ? '&' : '?';
            let tokenUrl = `${challenge.realm}${separator}scope=${encodeURIComponent(
                `repository:${image.name}:pull`,
            )}`;
            if (challenge.service) {
                tokenUrl += `&service=${encodeURIComponent(challenge.service)}`;
            }

            const axiosConfig: AxiosRequestConfig = {
                method: 'GET',
                url: tokenUrl,
                headers: { Accept: 'application/json' },
            };
            // Private repositories: send Basic credentials to the token endpoint.
            if (credentials) {
                axiosConfig.headers.Authorization = `Basic ${credentials}`;
            }

            const response = await axios(axiosConfig);
            // ACR answers `access_token`, the Docker spec uses `token`.
            const token = response.data.token || response.data.access_token;
            if (!token) {
                throw new Error(
                    `No token returned by the Alibaba token endpoint ${challenge.realm}`,
                );
            }
            return this.authenticateBearer(requestOptions, token);
        } catch (e) {
            // Degrade to the previous behaviour instead of breaking the watcher.
            this.log.warn(
                `Unable to get an Alibaba Bearer token for ${image.name} (${
                    (e as any).message
                }) => falling back to basic authentication`,
            );
            return credentials
                ? this.authenticateBasic(requestOptions, credentials)
                : requestOptions;
        }
    }
}

export default Alibaba;
