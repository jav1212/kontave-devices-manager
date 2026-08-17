# Kontave Device Manager

Aplicación Windows que conecta Kontave con dispositivos locales. El núcleo usa adaptadores para admitir lectores de códigos, impresoras fiscales, balanzas y otros equipos sin acoplarlos a la aplicación web.

## Desarrollo

Requiere Node.js 22 y pnpm.

```powershell
pnpm install
pnpm test
pnpm typecheck
pnpm desktop:dev
```

Para enumerar puertos seriales: `pnpm ports`. El Datalogic QW2100 admite dos modos:

- **USB-KBD/HID**: Windows lo trata como teclado y la lectura llega directamente a la ventana de Kontave que esté en primer plano.
- **USB-COM-STD**: Device Manager abre el puerto serial y entrega la lectura a Kontave mediante el gateway local.

Device Manager detecta ambos modos. En USB-KBD/HID reporta el lector como conectado, pero no intercepta teclas globales ni recibe lecturas destinadas a otra aplicación.

## Seguridad

- Escucha exclusivamente en `127.0.0.1:47831`.
- Rechaza orígenes que no estén en `allowedOrigins`.
- No transmite eventos hasta que el usuario aprueba el emparejamiento.
- Guarda únicamente el hash SHA-256 del token en `%LOCALAPPDATA%\Kontave\Device Manager\config.json`.
- Versiona el protocolo para detectar incompatibilidades.

En producción, Kontave usa HTTPS y el gateway debe configurarse con un certificado local confiable (`tlsPfxPath` y `tlsPfxPassphrase`). El instalador final debe firmarse con Authenticode mediante `CSC_LINK` y `CSC_KEY_PASSWORD`.

## Distribución

`pnpm dist:win` genera `Kontave-Device-Manager-Setup.exe` en `release/`. Al publicar una etiqueta `v*`, GitHub Actions ejecuta pruebas y publica el instalador, `latest.yml` y el blockmap en GitHub Releases. El nombre estable permite usar `/releases/latest/download/Kontave-Device-Manager-Setup.exe`, mientras `electron-updater` consulta el mismo canal automáticamente.

Para firmar, configura los secretos `WINDOWS_CERTIFICATE` (PFX en Base64 o URL admitida por electron-builder) y `WINDOWS_CERTIFICATE_PASSWORD`. Sin esos secretos se puede generar una versión de desarrollo, pero Windows mostrará una advertencia de editor desconocido.
