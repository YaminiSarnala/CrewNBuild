// ---------------------------------------------------------------------------
// The villa's sky, rebuilt for React Native.
//
// The web paints the backdrop into a 2D canvas and hands it to Three.js as a
// CanvasTexture: a vertical gradient, a band of stars, a drifting aurora and
// the occasional shooting star. React Native has no 2D canvas, so the same
// picture is written pixel by pixel into a DataTexture here.
//
// Two deliberate reductions, both for frame budget on a phone:
//   - The texture is 256x128 rather than 512x256. It is a soft gradient behind
//     a building, so the drop in resolution is not visible.
//   - The aurora and shooting stars are dropped. They repaint the whole sky
//     several times a second, which is cheap on a GPU-composited canvas and
//     expensive in a JS loop. The gradient, the stars and the star fade-in with
//     nightfall all remain, which is what carries the day/night read.
// ---------------------------------------------------------------------------
import { DataTexture, RGBAFormat, RepeatWrapping, SRGBColorSpace, UnsignedByteType } from 'three'

export const SKY_WIDTH = 256
export const SKY_HEIGHT = 128

// Web: stars sit in the top 34% of the backdrop, since the ground covers the rest.
const STAR_BAND = SKY_HEIGHT * 0.34
const STAR_COUNT = 150

function hexToRgb(hex) {
  const value = hex.replace('#', '')
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ]
}

function mix(a, b, amount) {
  return a + (b - a) * amount
}

/**
 * Builds the sky texture and returns it with a repaint function.
 *
 * `paint(night)` takes the same 0..1 value the rest of the scene uses, so the
 * sky crossfades in step with the lighting rather than switching at a threshold.
 */
export function createSkyTexture(dayColours, nightColours) {
  const pixels = new Uint8Array(SKY_WIDTH * SKY_HEIGHT * 4)

  const texture = new DataTexture(pixels, SKY_WIDTH, SKY_HEIGHT, RGBAFormat, UnsignedByteType)
  texture.colorSpace = SRGBColorSpace
  // Wrapped sideways so the sky slides round with the camera and the stars
  // travel with it rather than sitting pinned to the screen.
  texture.wrapS = RepeatWrapping
  texture.flipY = true

  const dayTop = hexToRgb(dayColours.skyTop)
  const dayBottom = hexToRgb(dayColours.sky)
  const nightTop = hexToRgb(nightColours.skyTop)
  const nightBottom = hexToRgb(nightColours.sky)

  // Fixed star field, generated once — they must not jump between repaints.
  const stars = Array.from({ length: STAR_COUNT }, () => {
    const y = Math.random() * STAR_BAND
    return {
      x: Math.floor(Math.random() * SKY_WIDTH),
      y: Math.floor(y),
      big: Math.random() < 0.18,
      brightness: (0.4 + Math.random() * 0.6) * (1 - (y / STAR_BAND) * 0.45),
    }
  })

  function paint(night) {
    const top = [
      mix(dayTop[0], nightTop[0], night),
      mix(dayTop[1], nightTop[1], night),
      mix(dayTop[2], nightTop[2], night),
    ]
    const bottom = [
      mix(dayBottom[0], nightBottom[0], night),
      mix(dayBottom[1], nightBottom[1], night),
      mix(dayBottom[2], nightBottom[2], night),
    ]

    // Vertical gradient. The horizon stays light enough to read the roofline
    // against after dark, exactly as the web comment describes.
    for (let y = 0; y < SKY_HEIGHT; y += 1) {
      const t = y / (SKY_HEIGHT - 1)
      const r = mix(top[0], bottom[0], t)
      const g = mix(top[1], bottom[1], t)
      const b = mix(top[2], bottom[2], t)

      for (let x = 0; x < SKY_WIDTH; x += 1) {
        const index = (y * SKY_WIDTH + x) * 4
        pixels[index] = r
        pixels[index + 1] = g
        pixels[index + 2] = b
        pixels[index + 3] = 255
      }
    }

    // Stars fade in with nightfall — invisible by day, as on the web.
    const starlight = Math.max(0, (night - 0.35) / 0.65)
    if (starlight > 0.01) {
      for (const star of stars) {
        const value = Math.round(255 * star.brightness * starlight)
        const plot = (px, py) => {
          if (px < 0 || px >= SKY_WIDTH || py < 0 || py >= SKY_HEIGHT) return
          const index = (py * SKY_WIDTH + px) * 4
          pixels[index] = Math.min(255, pixels[index] + value)
          pixels[index + 1] = Math.min(255, pixels[index + 1] + value)
          pixels[index + 2] = Math.min(255, pixels[index + 2] + value)
        }
        plot(star.x, star.y)
        if (star.big) {
          plot(star.x + 1, star.y)
          plot(star.x, star.y + 1)
          plot(star.x + 1, star.y + 1)
        }
      }
    }

    texture.needsUpdate = true
  }

  paint(0)

  return { texture, paint }
}