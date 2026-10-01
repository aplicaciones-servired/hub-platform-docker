// ═══════════════════════════════════════════════════════════════════════════
//  Jenkinsfile — HUB AI Assistant
//  Jenkins corre en el MISMO servidor que la app, con acceso al socket de
//  Docker (el usuario del agente debe estar en el grupo `docker`).
//
//  Flujo: verificar → backup → construir imágenes en el daemon local →
//  desplegar desde esas imágenes → verificar salud pública → (si falla)
//  revertir.
//
//  No hay registro de imágenes: Jenkins y la app comparten el mismo daemon
//  Docker, así que construir y desplegar es un paso local, no un push/pull.
//  Consecuencia: el rollback solo alcanza a tags que sigan en el daemon.
//
//  Los secretos NO están en el repo: se leen de credenciales del job, se
//  escriben en /opt/hub-platform/.env (600) y nunca se imprimen.
//  IDs de credenciales y valores: deploy/CREDENCIALES-JENKINS.md
// ═══════════════════════════════════════════════════════════════════════════

pipeline {
    agent any

    options {
        timestamps()
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '20', artifactNumToKeepStr: '5'))
        timeout(time: 90, unit: 'MINUTES')
    }

    parameters {
        string(
            name: 'APP_VERSION',
            defaultValue: '',
            description: 'Tag a desplegar. Vacío = sha del commit que se construyó.'
        )
        booleanParam(
            name: 'RUN_TESTS',
            defaultValue: true,
            description: 'Ejecutar los tests de backend/web/mobile antes de publicar.'
        )
        booleanParam(
            name: 'SKIP_BACKUP',
            defaultValue: false,
            description: 'No respaldar PostgreSQL antes de desplegar (solo si ya hay uno reciente).'
        )
        booleanParam(
            name: 'DRY_RUN',
            defaultValue: false,
            description: 'Construir y publicar imágenes SIN tocar los contenedores de producción.'
        )
        // Build args de los frontends: quedan INCRUSTADOS en el bundle, por eso
        // también se escriben en el .env del servidor (mismo valor en ambos
        // lados o el contacto del bundle discrepa del runtime).
        string(
            name: 'SUPPORT_WHATSAPP',
            defaultValue: 'https://wa.me/573166166514',
            description: 'WhatsApp de soporte incrustado en el bundle (NEXT_PUBLIC_SUPPORT_WHATSAPP).'
        )
        string(
            name: 'SUPPORT_PHONE',
            defaultValue: '+57 316 616 6514',
            description: 'Teléfono de soporte incrustado en el bundle (NEXT_PUBLIC_SUPPORT_PHONE).'
        )
    }

    environment {
        DEPLOY_DIR           = '/opt/hub-platform'
        COMPOSE_PROJECT      = 'hub'
        // Prefijo de las imágenes en el daemon LOCAL. No es un registro: no hay
        // push ni pull, `docker compose` resuelve el tag contra el daemon del
        // servidor. Se llama IMAGE_NAMESPACE (no DOCKERHUB_NAMESPACE) para que
        // nadie intente un `docker compose pull` esperando un repo remoto.
        IMAGE_NAMESPACE      = 'hub-platform'
        COMPOSE_FILES        = 'docker-compose.yml -f deploy/docker-compose.prod.yml'
        APP_DASHBOARD_DOMAIN = 'soporte.serviredgane.cloud'
        APP_MOBILE_DOMAIN    = 'app.serviredgane.cloud'
        NODE_IMAGE           = 'node:22-alpine'
    }

    stages {
        // ───────────────────────────────────────────────────────────────────
        stage('Preparar') {
            steps {
                script {
                    env.GIT_COMMIT = sh(script: 'git rev-parse HEAD', returnStdout: true).trim()
                    env.IMAGE_TAG = params.APP_VERSION?.trim() ?: env.GIT_COMMIT.take(12)
                    env.DRY_RUN = params.DRY_RUN.toString()
                    currentBuild.displayName = "#${env.BUILD_NUMBER} ${env.IMAGE_TAG}"

                    echo "Commit    : ${env.GIT_COMMIT}"
                    echo "Tag       : ${env.IMAGE_TAG}"
                    echo "Destino   : ${env.DEPLOY_DIR} (proyecto compose '${env.COMPOSE_PROJECT}')"

                    sh '''#!/bin/bash
                        set -euo pipefail
                        echo "docker  : $(docker --version)"
                        echo "compose : $(docker compose version)"
                        echo "git     : $(git --version)"
                        docker info >/dev/null 2>&1 || {
                            echo "El agente no tiene permiso sobre /var/run/docker.sock (añade el usuario al grupo docker y reinicia el agente)."; exit 1;
                        }
                        # rsync para sincronizar con /opt/hub-platform; curl y grep
                        # los usa scripts/smoke-test.sh al final del deploy.
                        for bin in rsync curl grep; do
                            command -v "$bin" >/dev/null || { echo "falta $bin en el agente (apt-get install -y rsync curl grep)"; exit 1; }
                        done

                        # Red externa compartida con el túnel de Cloudflare. Si
                        # faltara, compose abortaría con un error poco claro
                        # ("declared as external, but could not be found"), y
                        # solo en el stage de deploy, con las imágenes ya
                        # construidas y subidas.
                        docker network inspect red-gane-int >/dev/null 2>&1 || {
                            echo "No existe la red externa red-gane-int: docker network create red-gane-int"; exit 1;
                        }
                        echo "red     : red-gane-int OK"
                    '''
                }
            }
        }

        // ───────────────────────────────────────────────────────────────────
        stage('Verificar') {
            when { expression { return params.RUN_TESTS } }
            steps {
                // Los tests corren en node:22-alpine, la misma imagen base de
                // los Dockerfiles: el agente no necesita Node instalado.
                // -u uid:gid evita archivos propiedad de root en el workspace.
                sh '''#!/bin/bash
                    set -euo pipefail
                    uid=$(id -u); gid=$(id -g)
                    run_suite() {
                        local dir="$1" cmd="$2" extra="${3:-}"
                        echo "──────── $dir ────────"
                        docker run --rm \
                            -v "$PWD:/w" -w "/w/$dir" \
                            -u "$uid:$gid" \
                            -e HOME=/tmp \
                            -e npm_config_cache=/tmp/npm-cache \
                            -e CI=true \
                            -e NEXT_TELEMETRY_DISABLED=1 \
                            -e EXPO_PUBLIC_API_URL=/api \
                            "$NODE_IMAGE" sh -c "npm ci $extra && $cmd"
                    }
                    run_suite backend "npm test" "--legacy-peer-deps"
                    run_suite web     "npx tsc --noEmit && npm run lint && npm test" "--legacy-peer-deps"
                    run_suite mobile  "npm test" "--legacy-peer-deps"
                '''
            }
        }

        // ───────────────────────────────────────────────────────────────────
        stage('Respaldar base de datos') {
            when { expression { return !params.SKIP_BACKUP && !params.DRY_RUN } }
            steps {
                sh '''#!/bin/bash
                    set -euo pipefail
                    if ! docker ps --format '{{.Names}}' | grep -qx hub-postgres; then
                        echo "Primer deploy: no hay Postgres en ejecucion, nada que respaldar."
                        exit 0
                    fi
                    mkdir -p "$DEPLOY_DIR/backups"
                    BACKUP_DIR="$DEPLOY_DIR/backups" KEEP_DAYS=14 ./scripts/backup-db.sh
                    ls -1t "$DEPLOY_DIR/backups" | head -3
                '''
            }
        }

        // ───────────────────────────────────────────────────────────────────
        stage('Construir imágenes') {
            steps {
                // Build local con `docker build`: Jenkins y la app comparten el
                // mismo daemon (Jenkins corre en el servidor), así que las
                // imágenes no necesitan viajar a ningún registro. El stage
                // "Desplegar" las resuelve por tag contra este mismo daemon.
                // Consecuencia: el rollback solo alcanza a tags que sigan en el
                // daemon local (ver deploy/rollback.sh).
                sh '''#!/bin/bash
                    set -euo pipefail

                    build_img() {
                        local svc="$1" context="$2" dockerfile="$3"; shift 3
                        echo "──────── build $svc ($context) ────────"

                        # Arrays, no strings: el teléfono de soporte es
                        # "+57 300 000 0000" y con word-splitting se
                        # convertiría en cuatro --build-arg distintos.
                        local build_args=()
                        for arg in "$@"; do build_args+=(--build-arg "$arg"); done

                        docker build \
                            ${build_args[@]+"${build_args[@]}"} \
                            -f "$dockerfile" \
                            -t "$IMAGE_NAMESPACE/hub-$svc:$IMAGE_TAG" \
                            -t "$IMAGE_NAMESPACE/hub-$svc:latest" \
                            "$context"
                    }

                    # OJO: el contexto NO es la raiz en todos los casos.
                    # backend/Dockerfile hace COPY package*.json / src/ / scripts/
                    # con rutas relativas al backend, asi que su contexto es
                    # backend/ y el Dockerfile se referencia como
                    # backend/Dockerfile. web/Dockerfile y mobile/Dockerfile.web
                    # si necesitan shared/ y construyen desde la raiz.
                    # Los build args de los frontends son obligatorios: si
                    # llegan vacios, el bundle se publica roto (de ahi el
                    # fail-fast de mobile/Dockerfile.web y el smoke test).
                    build_img api    backend  backend/Dockerfile
                    build_img web    .        web/Dockerfile \
                        "NEXT_PUBLIC_SUPPORT_WHATSAPP=$SUPPORT_WHATSAPP" \
                        "NEXT_PUBLIC_SUPPORT_PHONE=$SUPPORT_PHONE"
                    build_img mobile .        mobile/Dockerfile.web \
                        "EXPO_PUBLIC_API_URL=/api"

                    # Comprobación de que la imagen existe y es usable: un build
                    # que "termina bien" pero no deja capa utilizable falla
                    # aquí, no tres minutos después en el compose up.
                    for svc in api web mobile; do
                        docker image inspect "$IMAGE_NAMESPACE/hub-$svc:$IMAGE_TAG" \
                            >/dev/null || { echo "no se construyo $IMAGE_NAMESPACE/hub-$svc:$IMAGE_TAG"; exit 1; }
                    done
                    docker image inspect "$IMAGE_NAMESPACE/hub-api:$IMAGE_TAG" \
                        --format 'api: {{.Id}} {{.Size}} bytes'
                '''
            }
        }

        // ───────────────────────────────────────────────────────────────────
        stage('Desplegar') {
            when { expression { return !params.DRY_RUN } }
            steps {
                withCredentials([
                    string(credentialsId: 'hub-postgres-password',    variable: 'POSTGRES_PASSWORD'),
                    string(credentialsId: 'hub-jwt-secret',           variable: 'JWT_SECRET'),
                    string(credentialsId: 'hub-jwt-refresh-secret',   variable: 'JWT_REFRESH_SECRET'),
                    string(credentialsId: 'hub-seed-admin-password',  variable: 'SEED_ADMIN_PASSWORD')
                ]) {
                    sh '''#!/bin/bash
                        set -euo pipefail

                        # 1.0. El directorio de despliegue tiene que existir y ser escribible por
                        #     el usuario del agente. El error del run anterior
                        #     fue `install -d -m` devolviendo ENOENT
                        #     ("cannot change permissions"), que en la practica
                        #     es una de estas tres cosas: ruta que es un symlink
                        #     colgado, padre (/opt) sin permiso para el agente, o
                        #     el agente dentro de un contenedor que no ve /opt.
                        #     Cada caso se reporta por separado con su arreglo.
                        if [ -L "$DEPLOY_DIR" ] && [ ! -e "$DEPLOY_DIR" ]; then
                            echo "ERROR: $DEPLOY_DIR es un symlink colgado -> $(readlink "$DEPLOY_DIR")"
                            echo "Arreglo: sudo rm $DEPLOY_DIR && sudo mkdir -p $DEPLOY_DIR"
                            exit 1
                        fi
                        mkdir -p "$DEPLOY_DIR" 2>/dev/null || {
                            echo "ERROR: no se pudo crear $DEPLOY_DIR."
                            echo "  padre        : $(dirname "$DEPLOY_DIR")"
                            echo "  existe?      : $([ -d "$(dirname "$DEPLOY_DIR")" ] && echo sí || echo NO EXISTE)"
                            echo "  escribible?  : $([ -w "$(dirname "$DEPLOY_DIR")" ] && echo sí || echo NO)"
                            echo "Arreglo: sudo mkdir -p $DEPLOY_DIR && sudo chown \$(id -un):\$(id -gn) $DEPLOY_DIR && sudo chmod 750 $DEPLOY_DIR"
                            exit 1;
                        }
                        [ -w "$DEPLOY_DIR" ] || {
                            echo "ERROR: $DEPLOY_DIR existe pero el agente no puede escribir (owner $(stat -c '%U:%G' "$DEPLOY_DIR"), modo $(stat -c '%a' "$DEPLOY_DIR"))."
                            echo "Arreglo: sudo chown -R \$(id -un):\$(id -gn) $DEPLOY_DIR"
                            exit 1;
                        }

                        # 1.1. Sincronizar el repo al directorio estable del
                        #    servidor. Se preserva .env, backups y .last-good,
                        #    y se excluyen los artefactos que el stage de tests
                        #    dejó en el workspace (node_modules puede pesar
                        #    cientos de MB y no sirve en el servidor).
                        rsync -a --delete \
                              --exclude '.git' \
                              --exclude '.env' \
                              --exclude 'backups' \
                              --exclude '.last-good' \
                              --exclude '.docker-*' \
                              --exclude 'node_modules' \
                              --exclude '.next' \
                              --exclude 'dist' \
                              --exclude '.expo' \
                              --exclude 'web-build' \
                              "$WORKSPACE/" "$DEPLOY_DIR/"
                        chmod +x "$DEPLOY_DIR/scripts/backup-db.sh" "$DEPLOY_DIR/deploy/"*.sh

                        # Lee una clave de un archivo KEY=VALUE sin fallar si no
                        # existe. sed recorta el prefijo; `|| true` evita que
                        # `set -e` mate el pipeline si el grep no encuentra nada.
                        read_env() {
                            local file="$1" key="$2"
                            [ -f "$file" ] || return 0
                            grep -m1 "^${key}=" "$file" 2>/dev/null | sed "s/^${key}=//" || true
                        }

# 2. Las integraciones opcionales NO son credenciales del job: se
                        #    recuperan del .env ya desplegado para que un valor
                        #    configurado a mano no se pierda al regenerar el
                        #    archivo. Si nunca se configuraron, quedan vacías y
                        #    el módulo correspondiente responde "no configurado".
                        #    Usar withCredentials(required:false) no sirve para
                        #    esto: el plugin falla igual si el ID no existe.
                        EXTERNAL_SYSTEMS_URL="$(read_env "$DEPLOY_DIR/.env" EXTERNAL_SYSTEMS_URL)"
                        EXPO_ACCESS_TOKEN="$(read_env "$DEPLOY_DIR/.env" EXPO_ACCESS_TOKEN)"

                        APP_VERSION="$IMAGE_TAG" \
                        POSTGRES_USER=hub_admin \
                        IMAGE_NAMESPACE="$IMAGE_NAMESPACE" \
                        APP_DASHBOARD_DOMAIN="$APP_DASHBOARD_DOMAIN" \
                        APP_MOBILE_DOMAIN="$APP_MOBILE_DOMAIN" \
                        EXTERNAL_SYSTEMS_URL="$EXTERNAL_SYSTEMS_URL" \
                        EXPO_ACCESS_TOKEN="$EXPO_ACCESS_TOKEN" \
                        NEXT_PUBLIC_SUPPORT_WHATSAPP="$SUPPORT_WHATSAPP" \
                        NEXT_PUBLIC_SUPPORT_PHONE="$SUPPORT_PHONE" \
                        DEPLOY_DIR="$DEPLOY_DIR" \
                        "$DEPLOY_DIR/deploy/render-env.sh"

                        # 3. Recrear los contenedores desde las imágenes que
                        #    acaba de construir el stage anterior, ya presentes
                        #    en este mismo daemon. Sin `pull`: no hay registro.
                        #    Sin migraciones manuales: el entrypoint de `api`
                        #    corre migrate + seed en cada arranque (deben
                        #    seguir siendo idempotentes).
                        cd "$DEPLOY_DIR"
                        DC="docker compose -p $COMPOSE_PROJECT -f $COMPOSE_FILES --env-file .env"
                        $DC config -q

                        # Si `up -d` falla (tipicamente un healthcheck que no
                        # llega a healthy) no dice por que. Antes de morir vuelca
                        # el estado y los logs de todos los servicios: sin esto
                        # cada fallo cuesta un pipeline completo a ciegas.
                        dump_diag() {
                            echo
                            echo "════════ DIAGNÓSTICO (fallo en compose up) ════════"
                            echo "──── estado ────"
                            $DC ps -a --format 'table {{.Service}}\t{{.State}}\t{{.Status}}' 2>&1 || true
                            for svc in postgres api web mobile edge; do
                                echo
                                echo "──── logs $svc (últimas 80) ────"
                                $DC logs --tail=80 --no-color "$svc" 2>&1 || true
                            done
                            echo
                            echo "════ FIN DIAGNÓSTICO ════"
                        }

                        if ! $DC up -d --no-build --remove-orphans; then
                            dump_diag
                            exit 1
                        fi
                    '''
                }
            }
        }

        // ───────────────────────────────────────────────────────────────────
        stage('Verificar despliegue') {
            when { expression { return !params.DRY_RUN } }
            steps {
                sh '''#!/bin/bash
                    set -euo pipefail
                    cd "$DEPLOY_DIR"
                    DC="docker compose -p $COMPOSE_PROJECT -f $COMPOSE_FILES --env-file .env"

                    echo "──────── API ────────"
                    # El header x-forwarded-proto es necesario: en producción
                    # src/index.ts devuelve 400 o redirige a HTTPS si la
                    # petición no llega como https, así que un curl en HTTP
                    # plano a 127.0.0.1 nunca vería un 200.
                    for i in $(seq 1 40); do
                        if curl -sf --max-time 5 -H 'x-forwarded-proto: https' \
                               http://127.0.0.1:3001/api/health >/dev/null 2>&1; then
                            echo "api OK (intento $i)"; break
                        fi
                        if [ "$i" -eq 40 ]; then
                            echo "la API no responde tras 2 min (puede ser una migracion lenta: revisa el log)"
                            $DC logs --tail=60 api; exit 1
                        fi
                        sleep 3
                    done

                    echo "──────── edge (nginx) ────────"
                    # La comprobación se hace DESDE un contenedor en
                    # red-gane-int, igual que el túnel de Cloudflare: valida
                    # resolución DNS por nombre (hub-edge) y el enrutado por
                    # Host, que es el camino real del tráfico. Con el edge sin
                    # puerto publicado en el host no hay nada que curlear desde
                    # fuera; dentro del propio contenedor solo se alcanzaría el
                    # default_server (444) sin Host.
                    probe_edge() {
                        docker run --rm --network red-gane-int nginx:1.27-alpine \
                            wget -q --tries=1 --spider --header="Host: $1" "http://hub-edge:8080$2"
                    }
                    for i in $(seq 1 20); do
                        if probe_edge "$APP_DASHBOARD_DOMAIN" /api/health \
                           && probe_edge "$APP_MOBILE_DOMAIN" /; then
                            echo "edge OK desde red-gane-int (intento $i)"; break
                        fi
                        if [ "$i" -eq 20 ]; then echo "el edge no responde desde la red"; $DC logs --tail=60 edge; exit 1; fi
                        sleep 3
                    done
                    $DC exec -T edge nginx -t

                    echo "──────── redes de los contenedores ────────"
                    # Un contenedor recreado fuera de la red `app` deja al edge
                    # sin poder resolver api/web/mobile (síntoma: dashboard en
                    # blanco). Comprobarlo aquí evita perseguir eso a ciegas.
                    # Los nombres reales llevan el prefijo del proyecto: hub_app.
                    APP_NET="${COMPOSE_PROJECT}_app"
                    DB_NET="${COMPOSE_PROJECT}_db"
                    nets_of() { echo " $(docker inspect -f '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}' "$1") "; }
                    for c in hub-api hub-web hub-mobile hub-edge; do
                        nets=$(nets_of "$c")
                        echo "$c ->$nets"
                        case "$nets" in
                            *" $APP_NET "*) : ;;
                            *) echo "REDS INCORRECTAS: $c no está en $APP_NET"; exit 1 ;;
                        esac
                        # El túnel entra por red-gane-int: sin esto el dashboard
                        # sirve por HTTPS y la PWA no responde (o al revés).
                        case "$nets" in
                            *" red-gane-int "*) : ;;
                            *) echo "REDS INCORRECTAS: $c no está en red-gane-int"; exit 1 ;;
                        esac
                    done
                    case "$(nets_of hub-api)" in
                        *" $DB_NET "*) : ;;
                        *) echo "REDS INCORRECTAS: hub-api no está en $DB_NET (no alcanzaría postgres)"; exit 1 ;;
                    esac
                    case "$(nets_of hub-postgres)" in
                        *" red-gane-int "*) echo "FALLO DE SEGURIDAD: postgres está expuesto en red-gane-int"; exit 1 ;;
                        *) echo "postgres solo en redes internas: OK" ;;
                    esac

                    echo "──────── público (vía Cloudflare Tunnel) ────────"
                    curl -sf --max-time 20 "https://$APP_DASHBOARD_DOMAIN/api/health" >/dev/null \
                        || { echo "dashboard no responde por HTTPS"; exit 1; }
                    curl -sf --max-time 20 -o /dev/null "https://$APP_MOBILE_DOMAIN/" \
                        || { echo "PWA no responde por HTTPS"; exit 1; }
                    echo "ambos hostnames sirven por HTTPS"

                    echo "──────── smoke test (bundle de la PWA) ────────"
                    ./scripts/smoke-test.sh "https://$APP_MOBILE_DOMAIN" "https://$APP_DASHBOARD_DOMAIN/api"

                    echo "──────── estado final ────────"
                    $DC ps
                '''
            }
        }

        // ───────────────────────────────────────────────────────────────────
        stage('Registrar versión estable') {
            when { expression { return !params.DRY_RUN } }
            steps {
                // Se escribe solo si todo lo anterior pasó: es el destino por
                // defecto de deploy/rollback.sh.
                sh 'echo "$IMAGE_TAG" > "$DEPLOY_DIR/.last-good"'
            }
        }
    }

    post {
        failure {
            script {
                // Un fallo en tests/build no tocó producción: revertir solo si hubo un
                // deploy previo exitoso. La condición es `.last-good` (lo
                // escribe el stage final solo si todo pasó), NO `.env`: este
                // lo crea render-env.sh al principio del stage Desplegar, así
                // que un fallo posterior a eso —incluso antes de levantar un
                // contenedor— cumpliría con la condición y dispararía un
                // rollback sin ningún despliegue al que volver.
                if (env.DRY_RUN != 'true' && fileExists("${env.DEPLOY_DIR}/.last-good")) {
                    echo "Deploy fallido: revirtiendo a la ultima version estable"
                    sh '''#!/bin/bash
                        set -euo pipefail
                        cd "$DEPLOY_DIR"
                        DEPLOY_DIR="$DEPLOY_DIR" \
                        COMPOSE_PROJECT="$COMPOSE_PROJECT" \
                        IMAGE_NAMESPACE="$IMAGE_NAMESPACE" \
                        ./deploy/rollback.sh \
                          || echo "ATENCION: el rollback automatico fallo; revisa los contenedores a mano"
                    '''
                } else {
                    echo "El build fallo antes de tocar produccion: no hace falta revertir."
                }
            }
        }
        cleanup {
            // Solo imágenes sin usar de hace una semana: nunca toca las que
            // sostienen un rollback posible.
            sh 'docker image prune -f --filter "until=168h" 2>/dev/null || true'
        }
    }
}
