import axios, { AxiosRequestConfig } from 'axios';
import Custom from '../custom/Custom';
import { ContainerImage } from '../../../model/container';

/** Default Docker Hub registry API base. */
const DEFAULT_HUB_URL = 'https://registry-1.docker.io';
/** Default Docker Hub token endpoint (used to fetch pull tokens). */
const DEFAULT_HUB_AUTH_URL = 'https://auth.docker.io/token';
/** Default `service` parameter expected by the Docker Hub token endpoint. */
const DEFAULT_HUB_SERVICE = 'registry.docker.io';

/**
 * Docker Hub integration.
 *
 * The Hub may be unreachable from some networks (network-level blocking, rate
 * limiting, ...). The registry API base and its token endpoint can therefore be
 * overridden to point at a Docker Hub mirror:
 *
 * - `url`     : registry API base (default `https://registry-1.docker.io`)
 * - `authurl` : token endpoint (default `https://auth.docker.io/token`)
 * - `service` : `service` parameter sent to the token endpoint
 *
 * When a custom `url` is configured without an explicit `authurl`, the mirror is
 * considered anonymous and no `Authorization` header is sent.
 */
class Hub extends Custom {
    async init() {
        // Registry API base (override it to use a Docker Hub mirror).
        this.configuration.url = this.configuration.url || DEFAULT_HUB_URL;

        const isDefaultRegistry = this.configuration.url === DEFAULT_HUB_URL;

        // Token endpoint:
        // - default registry => the real Docker Hub token endpoint
        // - custom registry  => undefined => anonymous mirror (no Authorization)
        if (!this.configuration.authurl) {
            this.configuration.authurl = isDefaultRegistry
                ? DEFAULT_HUB_AUTH_URL
                : undefined;
        }

        // `service` parameter expected by the token endpoint.
        if (!this.configuration.service) {
            this.configuration.service = isDefaultRegistry
                ? DEFAULT_HUB_SERVICE
                : this.getRegistryHost();
        }

        if (this.configuration.token) {
            this.configuration.password = this.configuration.token;
        }
    }

    /**
     * Host of the configured registry (used for canonical image names and as
     * the default token `service` parameter when a mirror is configured).
     */
    getRegistryHost(): string {
        try {
            return new URL(this.configuration.url).host;
        } catch {
            return String(this.configuration.url || '')
                .replace(/^https?:\/\//, '')
                .replace(/\/.*$/, '');
        }
    }

    /**
     * Get the Hub configuration schema.
     */
    getConfigurationSchema() {
        return this.joi.alternatives([
            this.joi.string().allow(''),
            this.joi.object().keys({
                url: this.joi.string().uri(),
                authurl: this.joi.string().uri(),
                service: this.joi.string(),
                login: this.joi.string(),
                password: this.joi.string(),
                token: this.joi.string(),
                auth: this.joi.string().base64(),
                watchdigest: this.joi.bool().optional(),
                suppressdigestwatchwarning: this.joi.bool().default(false),
            }),
        ]);
    }

    shouldWatchDigest(
        wudWatchDigestLabelValue: string,
        image: string,
        watchDigestDefault?: boolean,
    ) {
        let shouldWatch: boolean;
        if (wudWatchDigestLabelValue !== undefined) {
            shouldWatch = wudWatchDigestLabelValue.toLowerCase() === 'true';
        } else if (this.configuration.watchdigest !== undefined) {
            shouldWatch = this.configuration.watchdigest === true;
        } else {
            shouldWatch =
                watchDigestDefault !== undefined ? watchDigestDefault : false;
        }
        if (shouldWatch && !this.configuration.suppressdigestwatchwarning) {
            this.log.warn(
                `Watching digest for image ${image} may result in throttled requests`,
            );
        }

        return shouldWatch;
    }

    /**
     * Return true if image has no registry url.
     */
    match(imageUrl: string) {
        return !imageUrl || /^.*\.?docker.io$/.test(imageUrl);
    }

    /**
     * Normalize images according to Hub characteristics.
     */
    normalizeImage(image: ContainerImage) {
        const imageNormalized = super.normalizeImage(image);
        if (imageNormalized.name) {
            imageNormalized.name = imageNormalized.name.includes('/')
                ? imageNormalized.name
                : `library/${imageNormalized.name}`;
        }
        return imageNormalized;
    }

    /**
     * Authenticate to Hub (or to the configured mirror).
     */
    async authenticate(
        image: ContainerImage,
        requestOptions: AxiosRequestConfig,
    ) {
        const credentials = this.getAuthCredentials();

        // No token endpoint configured: anonymous mirror (or Hub without auth).
        // Explicitly configured credentials (e.g. basic-auth mirror) still apply.
        if (!this.configuration.authurl) {
            return credentials
                ? this.authenticateBasic(requestOptions, credentials)
                : requestOptions;
        }

        const axiosConfig: AxiosRequestConfig = {
            method: 'GET',
            url: `${this.configuration.authurl}?service=${this.configuration.service}&scope=repository:${image.name}:pull&grant_type=password`,
            headers: {
                Accept: 'application/json',
            },
        };

        // Add Authorization if any
        if (credentials) {
            axiosConfig.headers.Authorization = `Basic ${credentials}`;
        }

        const response = await axios(axiosConfig);
        const requestOptionsWithAuth = requestOptions;
        requestOptionsWithAuth.headers.Authorization = `Bearer ${response.data.token}`;
        return requestOptionsWithAuth;
    }

    getImageFullName(image: ContainerImage, tagOrDigest: string) {
        let fullName = super.getImageFullName(image, tagOrDigest);
        fullName = fullName.replace(`${this.getRegistryHost()}/`, '');
        fullName = fullName.replace(/library\//, '');
        return fullName;
    }
}

export default Hub;
