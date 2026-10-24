# Memory Card Photo Estimator

Estimate how many photos fit on a memory card. Enter a megapixel value or image dimensions. Select a file format and a card capacity.

## Usage

1. Select megapixels or pixel dimensions.
2. Enter the image resolution.
3. Select a file format.
4. Enter the card capacity in MB or GB.
5. Read the estimated photo count, file size, used space, and remaining space.

The estimator uses decimal storage units. One GB equals 1,000 MB. File size estimates use an average per megapixel, so actual results vary with camera settings, image content, and compression.

## Supported formats

- JPEG, HEIC, and HEIF
- RAW + JPG pairs, with a selectable RAW file type and compression mode
- Canon: `.CR2`, `.CR3`
- Nikon: `.NEF`, `.NRW`
- Sony: `.ARW`, `.ARQ`
- Fujifilm: `.RAF`
- OM System: `.ORF`
- Panasonic: `.RW2`
- Pentax: `.PEF`
- Samsung: `.SRW`
- Ricoh: `.DNG`
- Hasselblad: `.3FR`
- Phase One: `.IIQ`

## RAW size estimates

The estimator uses a 14-bit uncompressed baseline of 1.75 decimal MB per megapixel. It multiplies this baseline by a format-specific ratio. The uncompressed mode uses a ratio of 1.00.
For RAW + JPG, it adds the selected RAW estimate to the JPEG estimate of 0.25 MB per megapixel.

| RAW family | Compressed RAW estimate | Lossless compressed estimate |
| --- | ---: | ---: |
| Canon CR2 and CR3 | 0.54 | 0.70 |
| Nikon NEF and NRW | 0.55 | 0.70 |
| Sony ARW | 0.50 | 0.70 |
| Fujifilm RAF | 0.30 | 0.60 |
| Ricoh DNG | 0.55 | 0.78 |
| Other listed RAW types | 0.55 | 0.70 |

The Canon compressed estimate averages two CRAW-to-RAW examples. Canon manuals list 15.8 MB and 27.2 MB in one example, and 16.8 MB and 34.3 MB in another. The average ratio is 0.54. Canon reports that file sizes vary with shooting conditions. [Canon manual 1](https://cam.start.canon/th/C015/manual/c015.pdf), [Canon manual 2](https://cam.start.canon/id/C022/manual/c022.pdf)

Nikon reports 35–55% smaller files for compressed NEF and 20–40% smaller files for lossless compressed NEF. The estimator uses the midpoint remaining sizes of 0.55 and 0.70. [Nikon NEF recording manual](https://onlinemanual.nikonimglib.com/z7_z6/en-nsg/09_menu_guide_03_07.html)

Fujifilm reports compressed RAF files at 25–35% of uncompressed size and lossless compressed RAF files at 30–90%. The estimator uses the range midpoints of 0.30 and 0.60. [Fujifilm RAW recording manual](https://fujifilm-dsc.com/en/manual/gfx50s-ii/gfx50s2_manual_en_s_f.pdf)

Sony states that compressed ARW files are about half the size of uncompressed files. Sony describes lossless compression but does not give a ratio on this help page. The estimator uses 0.70 for lossless ARW. [Sony RAW file type guide](https://helpguide.sony.net/ilc/2110/v1/en/contents/TP1000659395.html)

Ricoh lists an approximate 70 MB RAW file for a 51 MP camera. This is about 0.78 of the 14-bit baseline. The estimator uses that ratio for lossless DNG. [Ricoh 645Z support FAQ](https://www.ricoh-imaging.co.jp/english/support/qa/645z/)

For formats without a published ratio in these sources, the estimator uses generic ratios of 0.55 for compressed RAW and 0.70 for lossless compressed RAW.
RAW sizes vary by camera model, bit depth, image content, and compression. These modes provide estimates. They do not describe which modes each camera supports.

Sony ARQ files are combined Pixel Shift results that Sony creates on a computer from four or sixteen source RAW frames. The ARQ option estimates the card space for those uncompressed source frames. It does not estimate the size of the combined ARQ output file. [Sony Imaging Edge guide](https://www.sony.com/electronics/support/compact-cameras-dsc-rx-series/dsc-rx0m2/software/00290423)

## Development

This app uses Next.js with a static export. It uses React, TypeScript, Tailwind CSS 4, and Bun.

```bash
bun install
bun run dev
bun run test
```

The calculation runs in the browser. The app does not need environment variables or a server API.
