module.exports = {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}'
  ],
  theme: {
    extend: {
      backgroundImage: {
        parchment: "url('/textures/parchment.jpg')",
        wood: "url('/textures/wood-dark.jpg')",
      },
      fontFamily: {
        pirate: ['Pirata One', 'cursive'],
        old: ['IM Fell English', 'serif']
      }
    },
  },
  plugins: [],
}
