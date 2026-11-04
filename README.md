# Planet Render 360 showcase

A responsive, interactive website that introduces the app from an explorer’s point of view. It follows the project’s Night palette, Glacier accent, Instrument typography, Lucide icons, brand lockups, and glass recipes.

## Preview

```sh
cd planet-render-360-website
npm run dev
```

Open <http://localhost:4173>. The site has no runtime dependencies or external network calls. Six destination previews offer captured directions, light changes, a Stockholm winter view, browser-local favourites, photo downloads, shareable showcase links, and a guided tour. The journey and toolkit sections show actual app screens. The showcase video opens on YouTube through a preview card or QR code; its thumbnail and QR image are served locally, with no embedded player.

The browser preview uses existing app captures; it does not run the Godot renderer. Free movement, live search and weather, calendar controls, drone mode, and offline downloads are described as features of the app. Shared website links reopen the captured preview; they are separate from the app’s `pr360://` links.

## Verify

```sh
npm run build
npm test
npm install
npx playwright install chromium
npm run test:browser
```

The Worker checks verify routes, assets, request methods, security headers, image formats, and hosting metadata. The browser checks exercise the built Worker on a temporary local port, including desktop and phone layouts, search, favourites and persistence, directions, time changes, seasons, tours, downloads, and restored view links. Review screenshots go to `review/` (ignored by Git).

## ChatGPT Sites publication

`npm run build` creates `dist/server/index.js` and `dist/.openai/hosting.json`. The Worker embeds the static assets so the output needs no external asset service, database, secrets, or build dependencies.

Create the Site once, then atomically merge its exact returned `project_id` into `.openai/hosting.json`. The contents of this repository are the website source. Push the reviewed source to the Site’s source repository, rebuild from that commit, and run `npm run package` to create `site.tar.gz`. The archive includes `.openai/hosting.json` and `dist/server/index.js` at their required paths. Save and deploy that exact pushed commit with the archive through Sites. New Sites remain private unless the owner requests a different audience.

Source repository: <https://github.com/TuononenP/planet-render-360-website>.

The website is hosted separately from the Godot app repository. Commit and push website source to the Site’s repository only with the owner’s authorization.

Site URL: https://planet-render-360-experience.rebase-8161.chatgpt.site

## Assets and credits

`asset-sources.json` records the source captures. Fonts and outlined brand assets come from the app. Font and Lucide licences are included in `public/assets/`. Scene and map credits appear in About this showcase.

Design reference: the local copy of `project/README.md` from the Planet Render 360 design-system artifact, together with `scripts/ui_theme.gd` and `scripts/hud_style.gd`.
