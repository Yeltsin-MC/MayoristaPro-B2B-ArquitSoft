# Configuración de Workers con Cron

## Workers Implementados

### 1. Expiración de Pedidos
**Script:** `apps/api/src/workers/expire-orders.cjs`  
**Frecuencia:** Cada 2 minutos  
**Comando:** `npm run expire:orders`

### 2. Recuperación de Webhooks
**Script:** `apps/api/src/workers/recover-webhooks.cjs`  
**Frecuencia:** Cada 5 minutos  
**Comando:** `npm run recover:webhooks`

## Configuración en Linux/macOS

Editar crontab:
```bash
crontab -e
```

Agregar líneas:
```cron
# MayoristaPro Workers
*/2 * * * * cd /ruta/mayoristapro && npm run expire:orders >> /var/log/mayorista-expire.log 2>&1
*/5 * * * * cd /ruta/mayoristapro && npm run recover:webhooks >> /var/log/mayorista-recover.log 2>&1
```

## Configuración en Windows (Task Scheduler)

### Worker de Expiración:
1. Abrir Task Scheduler
2. Create Basic Task → Name: "MayoristaPro Expire Orders"
3. Trigger: Daily, repeat every 2 minutes
4. Action: Start a program
   - Program: `cmd.exe`
   - Arguments: `/c cd "D:\path\mayoristapro" && npm run expire:orders`

### Worker de Recuperación:
1. Create Basic Task → Name: "MayoristaPro Recover Webhooks"
2. Trigger: Daily, repeat every 5 minutes
3. Action: Start a program
   - Program: `cmd.exe`
   - Arguments: `/c cd "D:\path\mayoristapro" && npm run recover:webhooks`

## Verificación

Ejecutar manualmente primero:
```bash
npm run expire:orders
npm run recover:webhooks
```

Ver logs:
```bash
tail -f /var/log/mayorista-*.log  # Linux
```

## Nota Importante

⚠️ **Los workers NO están programados automáticamente.**  
Esta configuración debe realizarse MANUALMENTE en el servidor de producción/staging.  
Los scripts están listos pero requieren setup de cron/scheduler del sistema operativo.
