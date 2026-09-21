<template>
  <v-container fluid class="pa-4">
    <v-card class="border" elevation="0" rounded="lg">
      <!-- Toolbar Header with Search & Actions -->
      <v-toolbar color="surface" density="compact" class="px-3 py-1">
        <v-icon :icon="watcherIcon" class="mr-2 text-primary" size="24"></v-icon>
        <div class="d-flex align-center">
          <span class="text-subtitle-1 font-weight-bold mr-2">{{ $t('servers.title') }}</span>
          <v-chip size="x-small" color="primary" variant="tonal" class="font-weight-medium">
            {{ watchersFiltered.length }}
          </v-chip>
        </div>

        <v-spacer></v-spacer>

        <!-- Search Input -->
        <v-text-field
          v-model="search"
          prepend-inner-icon="mdi-magnify"
          :placeholder="$t('config.searchWatchers')"
          density="compact"
          variant="outlined"
          hide-details
          clearable
          single-line
          class="mr-2 search-field"
          style="max-width: 260px;"
        ></v-text-field>

        <v-btn
          prepend-icon="mdi-plus"
          color="primary"
          variant="tonal"
          size="small"
          class="mr-2"
          @click="openAddWizard"
        >
          {{ $t('servers.add') }}
        </v-btn>

        <v-btn
          icon="mdi-refresh"
          variant="text"
          size="small"
          @click="refreshWatchers"
          :loading="isLoading"
          :title="$t('config.refresh')"
        ></v-btn>
      </v-toolbar>

      <v-divider />

      <!-- Data Table -->
      <v-data-table
        v-model:items-per-page="itemsPerPage"
        :headers="headers"
        :items="watchersFiltered"
        item-value="id"
        hover
        class="bg-surface"
        @click:row="onRowClick"
      >
        <!-- Status / Name Column -->
        <template #[`item.name`]="{ item }">
          <div class="d-flex align-center">
            <span class="status-dot mr-2" :class="isReachable(item.raw || item) ? 'status-ok' : 'status-ko'"></span>
            <span class="font-weight-medium">{{ item.raw ? item.raw.name : item.name }}</span>
          </div>
        </template>

        <!-- Source Column (host / socket / default) -->
        <template #[`item.source`]="{ item }">
          <div class="d-flex align-center">
            <v-icon size="small" class="mr-1 text-grey">{{ sourceIcon(item.raw || item) }}</v-icon>
            <span class="text-body-2 text-high-emphasis" v-if="sourceHost(item.raw || item)">{{ sourceHost(item.raw || item) }}</span>
            <v-chip
              v-else
              label
              variant="tonal"
              color="grey"
              size="x-small"
              class="font-weight-medium"
            >
              {{ sourceLabel(item.raw || item) }}
            </v-chip>
          </div>
        </template>

        <!-- Port Column -->
        <template #[`item.port`]="{ item }">
          <span v-if="sourcePort(item.raw || item)" class="text-body-2">
            {{ sourcePort(item.raw || item) }}
          </span>
          <span v-else class="text-caption text-grey font-italic">{{ $t('common.empty') }}</span>
        </template>

        <!-- Cron Column -->
        <template #[`item.cron`]="{ item }">
          <v-chip label variant="outlined" color="grey-darken-1" size="small" class="font-mono">
            {{ getCron(item.raw || item) }}
          </v-chip>
        </template>

        <!-- Watched count Column -->
        <template #[`item.watched`]="{ item }">
          <v-chip
            size="small"
            :color="watchedCount(item.raw || item) > 0 ? 'primary' : 'grey'"
            variant="tonal"
            class="font-weight-medium"
          >
            {{ watchedCount(item.raw || item) }} {{ $t('servers.watchedContainers') }}
          </v-chip>
        </template>

        <!-- Actions Column -->
        <template #[`item.actions`]="{ item }">
          <v-btn
            icon="mdi-trash-can-outline"
            variant="text"
            size="small"
            color="error"
            :title="$t('servers.removeTitle')"
            @click.stop="openRemoveDialog(item.raw || item)"
          ></v-btn>
        </template>

        <!-- Empty state -->
        <template v-slot:no-data>
          <div class="pa-8 text-center text-grey">
            <v-icon size="64" class="mb-4 opacity-50">{{ watcherIcon }}</v-icon>
            <div class="text-h6">{{ $t('servers.noServers') }}</div>
            <div class="text-body-2" v-if="search">{{ $t('config.tryClearSearch') }}</div>
            <div class="text-body-2" v-else>{{ $t('servers.noServersConfigured') }}</div>
          </div>
        </template>
      </v-data-table>
    </v-card>

    <!-- Server intro hint -->
    <v-card class="border mt-4" elevation="0" rounded="lg">
      <v-card-text class="text-body-2 text-medium-emphasis pa-4">
        <v-icon size="small" class="mr-2 text-primary align-top">mdi-information-outline</v-icon>
        {{ $t('servers.subtitle') }}
      </v-card-text>
    </v-card>

    <!-- Slide-over Server Detail Drawer -->
    <v-navigation-drawer
      v-model="drawerOpen"
      location="right"
      temporary
      :width="560"
      class="border-s"
      elevation="16"
    >
      <template v-if="selectedWatcher">
        <!-- Drawer Header -->
        <v-toolbar flat color="surface" class="border-b px-2">
          <div class="d-flex align-center overflow-hidden mr-2" style="flex: 1">
            <v-icon :icon="watcherIcon" size="24" class="mr-2 text-primary flex-shrink-0" />
            <div class="text-truncate">
              <div class="text-subtitle-1 font-weight-bold text-truncate">
                {{ selectedWatcher.name }}
              </div>
              <div class="text-caption text-grey text-truncate">
                {{ $t('servers.detailTitle') }}
              </div>
            </div>
          </div>
          <v-btn icon="mdi-close" variant="text" size="small" @click="drawerOpen = false" :title="$t('config.closeDetails')"></v-btn>
        </v-toolbar>

        <!-- Drawer Body -->
        <div class="overflow-y-auto" style="max-height: calc(100vh - 64px);">
          <configuration-drawer-content
            :item="selectedWatcher"
            :fallback-icon="watcherIcon"
          />
          <div class="pa-4">
            <v-btn
              block
              color="error"
              variant="tonal"
              prepend-icon="mdi-trash-can-outline"
              @click="removeTarget = selectedWatcher; drawerOpen = false; removeDialog = true"
            >
              {{ $t('servers.removeTitle') }}
            </v-btn>
          </div>
        </div>
      </template>
    </v-navigation-drawer>

    <!-- Add Server Wizard Dialog -->
    <v-dialog v-model="wizardOpen" max-width="760" scrollable>
      <v-card rounded="lg" class="border">
        <v-toolbar color="surface" density="compact" class="px-3 border-b">
          <v-icon icon="mdi-server-plus" size="22" class="mr-2 text-primary"></v-icon>
          <v-toolbar-title class="text-subtitle-1 font-weight-bold">{{ $t('servers.wizardTitle') }}</v-toolbar-title>
          <v-spacer></v-spacer>
          <v-btn icon="mdi-close" variant="text" size="small" @click="wizardOpen = false"></v-btn>
        </v-toolbar>

        <!-- Stepper header -->
        <div class="d-flex align-center pa-4 pb-2">
          <div v-for="(s, idx) in wizardSteps" :key="idx" class="d-flex align-center mr-3">
            <v-avatar
              size="24"
              :color="idx < wizardStep ? 'success' : (idx === wizardStep ? 'primary' : 'grey-lighten-2')"
              class="font-weight-bold text-white text-caption"
            >{{ idx < wizardStep ? '✓' : (idx + 1) }}</v-avatar>
            <span
              class="ml-1 text-caption font-weight-medium"
              :class="idx === wizardStep ? 'text-primary' : 'text-medium-emphasis'"
            >{{ $t(s.title) }}</span>
          </div>
        </div>

        <v-divider />

        <v-card-text class="pa-4 text-body-2">
          <div v-if="wizardStep === 0">
            <div class="text-caption text-medium-emphasis mb-3">{{ $t('servers.step1Hint') }}</div>
            <v-text-field
              v-model="wizard.name"
              :label="$t('servers.nameLabel')"
              :placeholder="$t('servers.namePlaceholder')"
              density="compact"
              variant="outlined"
              hide-details
              class="mb-4"
            ></v-text-field>
            <v-row>
              <v-col cols="8">
                <v-text-field
                  v-model="wizard.host"
                  :label="$t('servers.sshHostLabel')"
                  :placeholder="$t('servers.sshHostPlaceholder')"
                  density="compact"
                  variant="outlined"
                  hide-details
                ></v-text-field>
              </v-col>
              <v-col cols="4">
                <v-text-field
                  v-model.number="wizard.sshPort"
                  :label="$t('servers.sshPortLabel')"
                  :placeholder="$t('servers.sshPortPlaceholder')"
                  type="number"
                  density="compact"
                  variant="outlined"
                  hide-details
                ></v-text-field>
              </v-col>
            </v-row>
            <v-text-field
              v-model="wizard.user"
              :label="$t('servers.sshUserLabel')"
              :placeholder="$t('servers.sshUserPlaceholder')"
              density="compact"
              variant="outlined"
              hide-details
              class="mt-4"
            ></v-text-field>
            <v-text-field
              v-model.number="wizard.proxyPort"
              :label="$t('servers.proxyPortLabel')"
              type="number"
              density="compact"
              variant="outlined"
              hide-details
              class="mt-4"
            ></v-text-field>
            <div class="text-caption text-grey mt-1">{{ $t('servers.proxyPortHint') }}</div>
          </div>

          <div v-else-if="wizardStep === 1">
            <div class="text-caption text-medium-emphasis mb-3">{{ $t('servers.step2Hint') }}</div>

            <div class="text-subtitle-2 font-weight-bold mb-1">{{ $t('servers.step2ProxyBlockTitle') }}</div>
            <div class="text-caption text-grey mb-1">{{ $t('servers.step2ProxyBlockHint') }}</div>
            <v-card variant="tonal" color="grey-darken-4" rounded="md" class="mb-3">
              <pre class="pa-3 text-caption code-block mb-0" style="white-space: pre-wrap; word-break: break-word;">{{ proxyComposeYaml }}</pre>
            </v-card>

            <div class="text-subtitle-2 font-weight-bold mb-1">{{ $t('servers.step2UserTitle') }}</div>
            <div class="text-caption text-grey mb-1">{{ $t('servers.step2UserHint') }}</div>
            <v-card variant="tonal" color="grey-darken-4" rounded="md" class="mb-3">
              <pre class="pa-3 text-caption code-block mb-0" style="white-space: pre-wrap; word-break: break-word;">{{ targetUserCommands }}</pre>
            </v-card>

            <div class="text-subtitle-2 font-weight-bold mb-1">{{ $t('servers.step2PubkeyTitle') }}</div>
            <v-card variant="tonal" color="grey-darken-4" rounded="md" class="mb-1">
              <pre class="pa-3 text-caption code-block mb-0" style="white-space: pre-wrap; word-break: break-word;">{{ authorizedKeysLine }}</pre>
            </v-card>
          </div>

          <div v-else>
            <div class="text-caption text-medium-emphasis mb-3">{{ $t('servers.step3Hint') }}</div>
            <v-card variant="tonal" color="grey-darken-4" rounded="md" class="mb-3">
              <pre class="pa-3 text-caption code-block mb-0" style="white-space: pre-wrap; word-break: break-word;">{{ wudYamlBlock }}</pre>
            </v-card>

            <div class="text-subtitle-2 font-weight-bold mb-1">{{ $t('servers.step3RebuildTitle') }}</div>
            <div class="text-caption text-grey mb-1">{{ $t('servers.step3RebuildHint') }}</div>
            <v-card variant="tonal" color="grey-darken-4" rounded="md" class="mb-3">
              <pre class="pa-3 text-caption code-block mb-0" style="white-space: pre-wrap; word-break: break-word;">{{ rebuildCommand }}</pre>
            </v-card>
          </div>
        </v-card-text>

        <v-divider />
        <v-card-actions class="px-4 py-3">
          <v-spacer></v-spacer>
          <v-btn
            v-if="wizardStep > 0"
            variant="text"
            @click="wizardStep--"
          >{{ $t('servers.back') }}</v-btn>
          <v-btn
            v-if="wizardStep < 2"
            color="primary"
            variant="flat"
            :disabled="wizardStep === 0 && !wizardFormValid"
            @click="wizardStep++"
          >{{ $t('servers.next') }}</v-btn>
          <v-btn
            v-else
            color="primary"
            variant="flat"
            @click="wizardOpen = false"
          >{{ $t('config.closeDetails') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Remove Server Dialog -->
    <v-dialog v-model="removeDialog" max-width="620">
      <v-card rounded="lg" class="border">
        <v-toolbar color="surface" density="compact" class="px-3 border-b">
          <v-icon icon="mdi-server-remove" size="22" class="mr-2 text-error"></v-icon>
          <v-toolbar-title class="text-subtitle-1 font-weight-bold">
            {{ $t('servers.removeTitle') }}: {{ removeTarget ? removeTarget.name : '' }}
          </v-toolbar-title>
          <v-spacer></v-spacer>
          <v-btn icon="mdi-close" variant="text" size="small" @click="removeDialog = false"></v-btn>
        </v-toolbar>

        <v-card-text class="pa-4 text-body-2">
          <div class="text-caption text-medium-emphasis mb-3">{{ $t('servers.removeHint') }}</div>
          <div v-if="removeTarget" class="mb-3">
            <div class="text-subtitle-2 font-weight-bold mb-1">{{ $t('servers.removeSidecar') }}</div>
            <v-card variant="tonal" color="grey-darken-4" rounded="md" class="mb-3">
              <pre class="pa-3 text-caption code-block mb-0" style="white-space: pre-wrap; word-break: break-word;">{{ removeSidecarCommand }}</pre>
            </v-card>
            <div class="text-subtitle-2 font-weight-bold mb-1">{{ $t('servers.removeYaml') }}</div>
            <v-card variant="tonal" color="grey-darken-4" rounded="md" class="mb-3">
              <pre class="pa-3 text-caption code-block mb-0" style="white-space: pre-wrap; word-break: break-word;">{{ rebuildCommand }}</pre>
            </v-card>
          </div>
        </v-card-text>

        <v-divider />
        <v-card-actions class="px-4 py-3">
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="removeDialog = false">{{ $t('servers.close') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script lang="ts">
import ConfigurationDrawerContent from "@/components/ConfigurationDrawerContent.vue";
import { getAllWatchers, getWatcherIcon } from "@/services/watcher";
import { getAllContainers } from "@/services/container";
import { defineComponent } from "vue";

function placeholders(s: string, vars: Record<string, string>): string {
  let out = s;
  for (const k of Object.keys(vars)) {
    out = out.split(`{{${k}}}`).join(vars[k]);
  }
  return out;
}

export default defineComponent({
  name: "ConfigurationWatchersView",
  components: {
    ConfigurationDrawerContent,
  },

  data() {
    let itemsPerPage = 10;
    try {
      const saved = localStorage.getItem("itemsPerPage") || localStorage.itemsPerPage;
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed)) {
          itemsPerPage = parsed;
        }
      }
    } catch {
      // ignore
    }

    return {
      watchers: [] as any[],
      containers: [] as any[],
      search: "",
      drawerOpen: false,
      selectedWatcher: null as any,
      isLoading: false,
      itemsPerPage,
      // wizard
      wizardOpen: false,
      wizardStep: 0,
      wizardSteps: [
        { title: "servers.step1Title" },
        { title: "servers.step2Title" },
        { title: "servers.step3Title" },
      ],
      wizard: {
        name: "",
        host: "",
        sshPort: 22,
        user: "root",
        proxyPort: 2375,
      },
      // remove dialog
      removeDialog: false,
      removeTarget: null as any,
    };
  },

  watch: {
    itemsPerPage(val: number) {
      try {
        localStorage.setItem("itemsPerPage", String(val));
      } catch {
        // ignore
      }
    },
  },

  computed: {
    watcherIcon(): string {
      return getWatcherIcon();
    },
    headers() {
      return [
        {
          title: this.$t("config.name"),
          key: "name",
          value: (item: any) => item.name || "",
          sortable: true,
        },
        {
          title: this.$t("servers.host"),
          key: "source",
          value: (item: any) => this.sourceHost(item) || "",
          sortable: true,
        },
        {
          title: this.$t("servers.port"),
          key: "port",
          value: (item: any) => this.sourcePort(item) || "",
          sortable: true,
        },
        {
          title: this.$t("servers.cron"),
          key: "cron",
          value: (item: any) => this.getCron(item) || "",
          sortable: true,
        },
        {
          title: this.$t("servers.watchedContainers"),
          key: "watched",
          value: (item: any) => this.watchedCount(item),
          sortable: true,
        },
        {
          title: "",
          key: "actions",
          value: () => "",
          sortable: false,
          align: "end",
        },
      ];
    },
    watchersFiltered(): any[] {
      if (!this.search) {
        return this.watchers;
      }
      const s = this.search.toLowerCase().trim();
      return this.watchers.filter(
        (watcher) =>
          (watcher.name && watcher.name.toLowerCase().includes(s)) ||
          (watcher.type && watcher.type.toLowerCase().includes(s)) ||
          (watcher.id && watcher.id.toLowerCase().includes(s)) ||
          (this.sourceHost(watcher) || "").toLowerCase().includes(s)
      );
    },
    wizardFormValid(): boolean {
      return (
        this.wizard.name.trim().length > 0 &&
        this.wizard.host.trim().length > 0 &&
        this.wizard.sshPort > 0 &&
        this.wizard.user.trim().length > 0 &&
        this.wizard.proxyPort > 0
      );
    },
    nameSanitized(): string {
      return (this.wizard.name || "").trim().toLowerCase().replace(/[^a-z0-9._-]/g, "-");
    },
    proxyComposeYaml(): string {
      const port = this.wizard.proxyPort || 2375;
      return placeholders(`services:
  wud-socket-proxy:
    image: tecnativa/docker-socket-proxy:latest
    container_name: wud-socket-proxy
    restart: unless-stopped
    ports:
      - "127.0.0.1:{{port}}:2375"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
    environment:
      - CONTAINERS=1
      - IMAGES=1
      - NETWORKS=1
      - VOLUMES=1
      - INFO=1
      - EVENTS=1
      - PING=1
      - VERSION=1
      - POST=0
      - EXEC=0
      - BUILD=0
      - COMMIT=0
      - AUTH=0
      - SECRETS=0
      - CONFIGS=0
      - SWARM=0
      - SYSTEM=0
      - NODES=0
      - SERVICES=0
      - TASKS=0
      - PLUGINS=0
      - DISTRIBUTION=0
      - SESSION=0
      - GRPC=0
      - ALLOW_RESTARTS=0
      - ALLOW_START=0
      - ALLOW_STOP=0
      - ALLOW_PAUSE=0
      - ALLOW_UNPAUSE=0
      - LOG_LEVEL=info`, { port: String(port) });
    },
    targetUserCommands(): string {
      return placeholders(`# on the target host
sudo useradd --system --create-home --home-dir /home/wudtunnel \
  --shell /usr/sbin/nologin --comment 'WUD tunnel (read-only)' wudtunnel
grep -qx '/usr/sbin/nologin' /etc/shells || echo '/usr/sbin/nologin' | sudo tee -a /etc/shells
sudo install -d -m 700 -o wudtunnel -g wudtunnel /home/wudtunnel/.ssh
sudo tee /home/wudtunnel/.ssh/authorized_keys > /dev/null << 'EOF'
{{pubkey}}
EOF
sudo chown -R wudtunnel:wudtunnel /home/wudtunnel/.ssh
sudo chmod 600 /home/wudtunnel/.ssh/authorized_keys

# start the read-only proxy
cd /opt/wud-remote && sudo docker compose up -d

# sanity (should print 200, then 403 for a write)
curl -s -o /dev/null -w '%{http_code}\\n' http://127.0.0.1:{{port}}/version
curl -s -o /dev/null -w '%{http_code}\\n' -X POST http://127.0.0.1:{{port}}/containers/create`, {
        pubkey: this.authorizedKeysLine,
        port: String(this.wizard.proxyPort || 2375),
      });
    },
    authorizedKeysLine(): string {
      const name = this.nameSanitized || "server";
      return `restrict,port-forwarding,permitopen="127.0.0.1:${this.wizard.proxyPort || 2375}",command="/bin/false" ssh-ed25519 <PASTE_PUBLIC_KEY_HERE> wud-tunnel-${name}@wud-host`;
    },
    wudYamlBlock(): string {
      const name = this.nameSanitized || "server";
      const upper = name.toUpperCase();
      const host = (this.wizard.host || "").trim();
      const port = this.wizard.sshPort || 22;
      const proxyPort = this.wizard.proxyPort || 2375;
      const user = (this.wizard.user || "root").trim();
      return placeholders(`# --- server {{name}} ---
services:
  wud:
    networks: [default, wud-remote]   # add wud-remote if not present
    environment:
      - WUD_WATCHER_DOCKER_{{upper}}_HOST=docker-tunnel-{{name}}
      - WUD_WATCHER_DOCKER_{{upper}}_PORT=2375
      - "WUD_WATCHER_DOCKER_{{upper}}_CRON=30 4 * * *"
      - WUD_WATCHER_DOCKER_{{upper}}_WATCHBYDEFAULT=false
      - WUD_WATCHER_DOCKER_{{upper}}_WATCHDIGESTDEFAULT=true
      # only add a trigger if you want WUD to update containers there:
      # - WUD_TRIGGER_DOCKER_{{upper}}_PRUNE=false
      # - WUD_TRIGGER_DOCKER_{{upper}}_AUTO=false

  docker-tunnel-{{name}}:
    image: wud-ssh-tunnel:local
    build: { context: /opt/wud-remote }
    container_name: wud-tunnel-{{name}}
    restart: unless-stopped
    networks: [wud-remote]
    volumes:
      - /opt/wud-remote/ssh:/root/.ssh:ro
    command: >
      ssh -N -L 0.0.0.0:2375:127.0.0.1:{{proxyPort}}
      -i /root/.ssh/id_ed25519_{{name}}
      -p {{port}} {{user}}@{{host}}
      -o StrictHostKeyChecking=yes -o UserKnownHostsFile=/root/.ssh/known_hosts
      -o ExitOnForwardFailure=yes -o BatchMode=yes -o ConnectTimeout=12
      -o ServerAliveInterval=30 -o ServerAliveCountMax=3 -o TCPKeepAlive=yes

networks:
  wud-remote: { external: true, name: wud_remote_net }`, {
        name,
        upper,
        host,
        port: String(port),
        user,
        proxyPort: String(proxyPort),
      });
    },
    rebuildCommand(): string {
      return `cd <your WUD compose directory>
cp wud.yaml wud.yaml.bak.$(date +%Y%m%d%H%M%S)
# edit wud.yaml, then:
docker compose -f wud.yaml config -q
docker compose -f wud.yaml up -d
# verify
docker logs wud 2>&1 | grep -E 'Register watcher|Listening to docker events'`;
    },
    removeSidecarCommand(): string {
      const name = this.removeTarget ? this.removeTarget.name : "server";
      const upper = name.toUpperCase();
      return `cd <your WUD compose directory>
docker rm -f wud-tunnel-${name}
# then strip the "server ${name}" watcher block from wud.yaml:
#   services.wud.environment: WUD_WATCHER_DOCKER_${upper}_* (and WUD_TRIGGER_DOCKER_${upper}_* if any)
#   services.docker-tunnel-${name}: (the whole sidecar service)
docker compose -f wud.yaml up -d
# optional: rm the key so it can't be reused
rm -f /opt/wud-remote/ssh/id_ed25519_${name}`;
    },
  },

  methods: {
    isReachable(item: any): boolean {
      const cfg = item?.configuration || {};
      // A local (socket) watcher is by definition reachable.
      if (cfg.socket || !cfg.host) {
        return true;
      }
      // A remote watcher is considered reachable if it has reported at least
      // one container to WUD. Nothing discovered suggests the daemon or the
      // tunnel is down.
      const name = item?.name;
      return name ? this.containers.some((c) => c.watcher === name) : false;
    },
    sourceIcon(item: any): string {
      const cfg = item?.configuration || {};
      return cfg.socket ? "mdi-usb" : (cfg.host ? "mdi-server-network" : "mdi-server");
    },
    sourceHost(item: any): string {
      const cfg = item?.configuration || {};
      return cfg.host || (cfg.socket ? cfg.socket : "");
    },
    sourcePort(item: any): number | string {
      const cfg = item?.configuration || {};
      return cfg.host ? (cfg.port || 2375) : "";
    },
    sourceLabel(item: any): string {
      const cfg = item?.configuration || {};
      if (cfg.socket) return this.$t("servers.sourceLocal");
      if (cfg.host) return this.$t("servers.sourceRemote");
      return this.$t("servers.sourceDefault");
    },
    getCron(item: any): string {
      const cfg = item?.configuration || {};
      return cfg.cron || "* * * * *";
    },
    watchedCount(item: any): number {
      const name = item?.name;
      if (!name || !Array.isArray(this.containers)) return 0;
      return this.containers.filter((c) => c.watcher === name).length;
    },
    onRowClick(event: any, row: any) {
      const item = row?.item?.raw || row?.item || row;
      if (item) {
        this.selectedWatcher = item;
        this.drawerOpen = true;
      }
    },
    openAddWizard() {
      this.wizard = { name: "", host: "", sshPort: 22, user: "root", proxyPort: 2375 };
      this.wizardStep = 0;
      this.wizardOpen = true;
    },
    openRemoveDialog(item: any) {
      this.removeTarget = item;
      this.removeDialog = true;
    },
    async refreshWatchers() {
      this.isLoading = true;
      try {
        const [watchers, containers] = await Promise.all([getAllWatchers(), getAllContainers()]);
        this.watchers = watchers.sort((w1: any, w2: any) => (w1.id || w1.name || "").localeCompare(w2.id || w2.name || ""));
        this.containers = Array.isArray(containers) ? containers : [];
        if (this.selectedWatcher) {
          const updated = this.watchers.find((w) => (w.id || w.name) === (this.selectedWatcher.id || this.selectedWatcher.name));
          if (updated) {
            this.selectedWatcher = updated;
          }
        }
      } catch (e: any) {
        (this as any).$eventBus?.emit(
          "notify",
          this.$t("config.loadWatchersError", { msg: e.message }),
          "error"
        );
      } finally {
        this.isLoading = false;
      }
    },
  },

  async beforeRouteEnter(to, from, next) {
    try {
      const [watchers, containers] = await Promise.all([getAllWatchers(), getAllContainers()]);
      next((vm: any) => {
        vm.watchers = watchers;
        vm.containers = Array.isArray(containers) ? containers : [];
      });
    } catch (e: any) {
      next((vm: any) => {
        vm.$eventBus?.emit(
          "notify",
          vm.$t("config.loadWatchersError", { msg: e.message }),
          "error"
        );
      });
    }
  },
});
</script>

<style scoped>
:deep(.v-data-table tbody tr) {
  cursor: pointer;
  transition: background-color 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
  flex-shrink: 0;
}
.status-ok {
  background-color: #4caf50;
  box-shadow: 0 0 0 3px rgba(76, 175, 80, 0.2);
}
.status-ko {
  background-color: #f44336;
  box-shadow: 0 0 0 3px rgba(244, 67, 54, 0.15);
}
.code-block {
  font-family: "JetBrains Mono", "Fira Code", "Consolas", monospace;
  line-height: 1.45;
  overflow-x: auto;
}
.font-mono {
  font-family: "JetBrains Mono", "Fira Code", "Consolas", monospace;
}
</style>