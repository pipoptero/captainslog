# ⚓ Captain's Log — Gestor de Mercado Pirata

Aplicación web para gestionar el tablero de mercado del juego de mesa **Captain's Log** durante la partida. Lleva el control del stock de cada nación, los precios de compra y venta, las reposiciones automáticas y el registro de todas las transacciones.

🌐 **[Abrir la aplicación](https://pipoptero.github.io/captainslog/)**

---

## 📋 Funcionalidades

- **Inicio de partida aleatorio** — las 4 naciones se colocan en orden aleatorio y el mercado se rellena tirando 2d6 (uno para legal, uno para contrabando) por cada nación, siguiendo las capacidades reales de cada tramo del tablero
- **Cara A / Cara B** — cambia entre las dos caras del tablero con un solo botón; los precios se actualizan automáticamente
- **Compra y venta** (legal y contrabando) con las reglas oficiales:
  - Compra de derecha a izquierda (del tramo más barato al más caro)
  - Precio de venta determinado por el primer hueco libre desde la izquierda
  - Redondeo desfavorable a múltiplos de 500
- **Reposición automática** al vender — la mitad de las mercancías vendidas se reponen en el mercado de la nación inferior, de izquierda a derecha respetando la capacidad máxima de cada tramo
- **Contrabando vinculado** — cada puerto muestra el contrabando de la nación superior; compra y venta operan sobre esa fila correctamente
- **↩ Deshacer** la última acción de compra o venta
- **Historial** de todas las transacciones con hora
- **Estado persistente** — si cierras el navegador y vuelves, la partida sigue donde la dejaste

---

## 🃏 Tablero de mercado

Cada tarjeta de nación muestra:

| Elemento | Descripción |
|---|---|
| **Fila Legal** | Stock propio de la nación (T1–T4) |
| **Fila Contrabando** | Stock de la nación superior en el orden actual |
| **▲ precio** | Lo que recibes al vender al mercado |
| **▼ precio** | Lo que pagas al comprar del mercado |
| **Puntitos** | Capacidad máxima del tramo |
| **Borde verde** | Tramo donde se colocaría la próxima venta |

---

## 🗺️ Orden circular y contrabando

Al iniciar partida las naciones se colocan en orden aleatorio formando un círculo:

```
Nación 1 → Nación 2 → Nación 3 → Nación 4 → (vuelve a Nación 1)
```

- El **contrabando** en cada puerto = mercancía de la **nación superior** (la anterior en el círculo)
- La **reposición** al vender = va a la **nación inferior** (la siguiente en el círculo)

---

## 🛠️ Tecnologías

- [React 18](https://react.dev/)
- [Vite 5](https://vitejs.dev/)
- CSS puro con variables (sin Tailwind en runtime)
- Fuentes: [Pirata One](https://fonts.google.com/specimen/Pirata+One) + [Cinzel](https://fonts.google.com/specimen/Cinzel) + [Crimson Text](https://fonts.google.com/specimen/Crimson+Text)

---

## 🚀 Desarrollo local

```bash
# Instalar dependencias
npm install

# Servidor de desarrollo
npm run dev

# Build de producción
npm run build
```

---

## 📄 Licencia

Proyecto personal para uso con el juego de mesa Captain's Log. Sin fines comerciales.
