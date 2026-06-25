# Amir Ghorbani — Portfolio

Personal portfolio website for **Amir Ghorbani**, a frontend-focused software developer based in Auckland, New Zealand.

**[amirghorbani.dev](https://amirghorbani.dev)**

![Portfolio Preview](images/portrait-statue-opt.png)

---

## Overview

A single-page portfolio built with vanilla HTML, CSS, and JavaScript. Features interactive WebGL backgrounds (neural noise, 3D particle network, rising embers), scroll-driven reveal animations, and a terminal-styled contact form.

### Featured Projects

| Project | Description | Links |
|---------|-------------|-------|
| **AI Strawberry Disease Detection** | Hybrid YOLOv9-DETR model for disease and ripeness detection across 9,000+ images | [Repo](https://github.com/AmirmasoudGhorbani/hybrid-yolov9-detr-strawberry-disease) |
| **Scalable Rental Platform** | Interactive AWS architecture diagram with animated request tracing and Terraform IaC | [Live Demo](https://amirghorbani.dev/rental-platform-architecture/architecture/) · [Repo](https://github.com/AmirmasoudGhorbani/rental-platform-architecture) |
| **IoT Weather Monitoring** | Real-time dashboard for Raspberry Pi sensors over MQTT with live Auckland weather data | [Live Demo](https://amirghorbani.dev/iot-weather-station/dashboard/) · [Repo](https://github.com/AmirmasoudGhorbani/iot-weather-station) |
| **TV Signal Solutions Website** | Responsive marketing site for a local Auckland installation business | [Live Site](https://signal-solution-website.vercel.app) · [Repo](https://github.com/AmirmasoudGhorbani/Signal-Solution-Website) |

## Tech Stack

- **Frontend** — HTML, CSS, JavaScript, React, TypeScript, Next.js
- **Backend** — Node.js, PostgreSQL, Python
- **Cloud & DevOps** — AWS, Git, Docker
- **AI / ML** — PyTorch, YOLOv9, DETR, Computer Vision

## Repository Structure

```
Portfolio/
├── index.html                          # main portfolio page
├── styles.css                          # design system
├── script.js                           # interactions, WebGL, animations
├── site.webmanifest
├── CNAME
├── assets/
│   ├── ag-logo-web.png                 # brand logo / favicon
│   └── Amir-Ghorbani-CV.pdf            # downloadable CV
├── images/                             # project screenshots and portrait
├── iot-weather-station/                # IoT dashboard (subpage)
│   ├── dashboard/
│   ├── firmware/
│   └── node-red/
└── rental-platform-architecture/       # cloud architecture (subpage)
    ├── architecture/
    ├── infrastructure/
    └── docs/adr/
```

## Development

No build step required. Open `index.html` in a browser or serve with any static server:

```bash
npx serve .
```

The contact form uses [Web3Forms](https://web3forms.com) — no backend server needed.

## Deployment

Hosted on **GitHub Pages** with a custom domain via the `CNAME` file. Push to `main` to deploy.

## License

MIT — see [LICENSE](./LICENSE).
