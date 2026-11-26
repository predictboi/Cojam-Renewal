# Image sources

Every picture in this folder was drawn for this project as an SVG illustration in the Cojam palette without lime (blue `#124CC4`, ink `#0B1530`, sky `#97DBFF`, snow `#FDFDFF`): lime is reserved for actions, selection, day progress and the reward. No third party photo or artwork is used, nothing is hotlinked, and there is no licence to track: the files belong to the Cojam repository.

| File | Used by | What it shows | Source | Licence |
| --- | --- | --- | --- | --- |
| `q1-bitcoin.svg` | mock question 1 (Crypto) | A coin in front of a rising price line | Drawn for this project (generated SVG) | Project owned |
| `q2-dollar-won.svg` | mock question 2 (Markets) | Two coins over a bar chart | Drawn for this project (generated SVG) | Project owned |
| `q3-seoul-weather.svg` | mock question 3 (Weather) | Sun behind a cloud over a city skyline | Drawn for this project (generated SVG) | Project owned |
| `q4-football.svg` | mock question 4 (Sports) | Football flying into a goal net | Drawn for this project (generated SVG) | Project owned |
| `q5-kaia.svg` | mock question 5 (Crypto) | Up and down arrows over price candles | Drawn for this project (generated SVG) | Project owned |

Format: 4:5 portrait (viewBox 800 x 1000). Rules for every question picture, drawn or generated: no text, numbers or labels inside the picture (the card carries all text, in three languages); the focal object sits in the top 45% of the frame and away from the two top corners (the chips sit there); the lower half is covered by the question and the two choice buttons, so nothing important goes there.

The fallback for a question with no image is not a file: the card draws the category icon on the blue grid ground (see `.qimg--fallback` in `components.css`).

If photos are used later, save them here at about 800 px wide (WebP or JPEG, under 120 KB), never hotlink, and add a row with the photographer, the source URL and the licence.
