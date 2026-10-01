// ═══════════════════════════════════════════════════════════════════════════
//  Crea (o actualiza) las credenciales que consume el Jenkinsfile.
//  Ejecución: Jenkins → Manage Jenkins → Script Console → pegar → Run.
//
//  Es idempotente: si el ID ya existe, actualiza el valor en vez de fallar.
//  Los valores vienen de variables de entorno del propio job; este script no
//  inventa ni imprime secretos.
//
//  Configurar antes (Store → System → Global properties):
//      HUB_POSTGRES_PASSWORD=...
//      HUB_JWT_SECRET=...
//      HUB_JWT_REFRESH_SECRET=...
//      HUB_SEED_ADMIN_PASSWORD=...
//
//  EXTERNAL_SYSTEMS_URL y EXPO_ACCESS_TOKEN no se gestionan aquí: no son
//  credenciales del job, el pipeline las conserva del .env ya desplegado.
//
//  Alternativa sin Script Console: crear cada credencial a mano en
//  Manage Jenkins → Credentials → System → Global credentials, con los IDs
//  de la tabla que aparece abajo. Secret text marcada como "sensitive" para
//  que Jenkins no deje permitirlos en el build.
// ═══════════════════════════════════════════════════════════════════════════

import com.cloudbees.plugins.credentials.CredentialsScope
import com.cloudbees.plugins.credentials.SystemCredentialsProvider
import com.cloudbees.plugins.credentials.domains.Domain
import com.cloudbees.plugins.credentials.impl.UsernamePasswordCredentialsImpl

def store = SystemCredentialsProvider.getInstance().getStore()
def domain = Domain.global()

def required = [
    'HUB_POSTGRES_PASSWORD'   : 'hub-postgres-password',
    'HUB_JWT_SECRET'          : 'hub-jwt-secret',
    'HUB_JWT_REFRESH_SECRET'  : 'hub-jwt-refresh-secret',
    'HUB_SEED_ADMIN_PASSWORD' : 'hub-seed-admin-password',
]

def upsert = { String id, String value, String comment ->
    def existing = store.getCredentials(domain).find { it.id == id }
    def creds = new UsernamePasswordCredentialsImpl(
        CredentialsScope.GLOBAL, id, comment,
        '', value            // usuario vacío: solo se usa el secreto
    )
    if (existing) {
        store.updateCredentials(domain, existing, creds)
        return "actualizada"
    }
    store.addCredentials(domain, creds)
    return "creada"
}

def report = [:]

required.each { envVar, id ->
    def value = System.getenv(envVar)
    if (!value?.trim()) {
        report[id] = "FALTA ${envVar} en las propiedades globales; no se creó"
        return
    }
    def note = switch (id) {
        case 'hub-jwt-secret':
        case 'hub-jwt-refresh-secret':
            value.length() >= 32 ? 'ok' : "ERROR: ${envVar} tiene menos de 32 caracteres"
        case 'hub-postgres-password':
            value.length() >= 16 ? 'ok' : "ERROR: ${envVar} tiene menos de 16 caracteres"
        case 'hub-seed-admin-password':
            value.length() >= 12 ? 'ok' : "ERROR: ${envVar} tiene menos de 12 caracteres"
        default: 'ok'
    }
    if (note == 'ok') {
        report[id] = upsert(id, value.trim(), "HUB AI Assistant — ${envVar} (deploy)")
    } else {
        report[id] = note
    }
}

store.save()

report.each { id, status -> println "${id.padRight(28)} ${status}" }
println "\nListo. Configura las credenciales del job (folder o global) con estos IDs."
