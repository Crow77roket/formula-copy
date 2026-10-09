# Formula Copy

Extensión de Chrome — copie fórmulas KaTeX como código fuente LaTeX limpio.

[English](../README.md)

## Instalación

1. Abra `chrome://extensions`, active el modo desarrollador
2. Cargue la extensión desempaquetada seleccionando este directorio
3. Abra chatgpt.com — el icono se vuelve verde cuando está activo

## Uso

- Seleccione texto con fórmulas, **Ctrl+C**, pegue para obtener LaTeX (`$…$` / `$$…$$`)
- Haga clic en el icono para activar/desactivar en cualquier sitio
- Icono verde = activo en el sitio actual, gris = inactivo
- Haga clic en el pequeño botón junto al selector de idioma, en la parte superior
  de la ventana, para alternar entre `$...$` / `$$...$$` (predeterminado, botón `$`)
  y `\(...\)` / `\[...\]` (botón `\(\)`). Pase el cursor sobre el botón para ver
  los ejemplos completos de los delimitadores. Su elección se guarda automáticamente
  de forma local y se aplica de inmediato a todos los sitios activados,
  sin necesidad de recargar la página.

## Funcionalidades

- Fórmulas individuales, texto mixto, tablas HTML soportadas
- Texto sin fórmulas permanece intacto
- No interfiere con el botón de copia de bloques de código de ChatGPT
- Interfaz en 8 idiomas

## Pruebas

```bash
npm install
npm test
```
