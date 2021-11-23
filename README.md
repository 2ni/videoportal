# About
This is a simple and lightweight video portal implemented in expressjs with handlebars as template engine. Best install it on eg a raspberry pi or internal server. You can then play your videos on any browser within your internal network.

Some features:
- no external javascript, only uses vanilla javascript
- no database used, just uses directory structure to show list of movies or groups
- uses standard video player, no tracking or ads (unless within video itself)
- automatic fullscreen mode on mobile landscape mode
- saves last seen time, so you can continue where you stopped
- uses websockets to control videos on other screens, eg from mobile to desktop

### Installation
```
npm init
npm install
```

### Run
```
npm run dev
```
