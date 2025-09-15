/**
 * Script injected into every HTML page in dev mode.
 * Its responsibilities are:
 * 1. Create a WebSocket connection to the dev server.
 * 2. Listen for the 'reload' message and refresh the page.
 * 3. Automatically try to reconnect if the connection is lost.
 */
export const hmrScript = `
<script>
(function connect(){
 let retryCount = 0;
 const maxRetries = 5;
 
 function createConnection() {
   const ws = new WebSocket("ws://" + location.host + "/_ws");
   
   ws.onmessage = (ev) => {
      if (ev.data === "reload") {
        console.log("🔄 Full page reload requested");
        location.reload();
        return;
      }
      try {
        const message = JSON.parse(ev.data);
        if (message.type === 'css-update' && message.path) {
          console.log('🎨 Applying CSS updates...');
          const link = document.querySelector(\`link[rel="stylesheet"][href^="\${message.path}"]\`);
          if (link) {
            const newHref = message.path + '?t=' + Date.now();
            link.href = newHref;
          } else {
            // Fallback to reload if the link isn't found
            console.log("Could not find stylesheet, reloading page.");
            location.reload();
          }
        }
      } catch (e) {
        console.error("HMR error:", e);
      }
    };

   ws.onopen = () => {
     retryCount = 0;
     console.log("🔗 HMR connected");
   };
   
   ws.onclose = () => {
     if (retryCount < maxRetries) {
       retryCount++;
       setTimeout(createConnection, Math.min(1000 * retryCount, 5000));
     }
   };
   
   ws.onerror = () => {
     console.log("🔌 HMR connection error");
   };
 }
 
 createConnection();
})();
</script>
`;
