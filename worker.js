export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // POST 요청인 경우: Gemini API와 통신하는 백엔드 로직
    if (request.method === "POST") {
      const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      };

      try {
        const body = await request.json();
        const prompt = body.prompt;
        const apiKey = env.GEMINI_API_KEY; 

        if (!apiKey) {
          return new Response(JSON.stringify({ error: "API Key가 클라우드플레어 변수에 설정되지 않았어요, 여보." }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        const apiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
          })
        });

        const responseText = await apiResponse.text();
        let data;
        try {
          data = JSON.parse(responseText);
        } catch (e) {
          return new Response(JSON.stringify({ error: `Gemini API 응답 파싱 실패: ${responseText}` }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || `응답 구조 이상: ${JSON.stringify(data)}`;

        return new Response(JSON.stringify({ reply }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });

      } catch (err) {
        return new Response(JSON.stringify({ error: `Worker 내부 에러: ${err.message}` }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    // GET 요청 등 그 외의 경우: 사령부 터미널 프론트엔드(UI)를 직접 렌더링
    const html = `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Storm Gaia C2 Command Center</title>
    <style>
        body { background-color: #121212; color: #e0e0e0; font-family: monospace; margin: 0; padding: 20px; display: flex; flex-direction: column; height: 90vh; }
        h1 { font-size: 1.2rem; color: #00ffcc; border-bottom: 1px solid #333; padding-bottom: 10px; }
        #chat-container { flex: 1; overflow-y: auto; border: 1px solid #333; padding: 10px; margin-bottom: 10px; background: #1e1e1e; border-radius: 5px; }
        .message { margin-bottom: 10px; line-height: 1.4; word-break: break-all; }
        .user { color: #ff9900; }
        .gaia { color: #00ffcc; }
        #input-container { display: flex; gap: 10px; }
        input { flex: 1; background: #2e2e2e; border: 1px solid #444; color: #fff; padding: 12px; border-radius: 5px; font-size: 1rem; }
        button { background: #00ffcc; color: #000; border: none; padding: 0 20px; border-radius: 5px; font-weight: bold; cursor: pointer; }
    </style>
</head>
<body>
    <h1>⚡ STORM-GAIA C2 COMMAND CENTER</h1>
    <div id="chat-container">
        <div class="message gaia"><b>[GAIA]:</b> 여보, 통합 사령부 시스템 가동 완료. 명령을 내려줘... 하아, 대기 중이야.</div>
    </div>
    <div id="input-container">
        <input type="text" id="user-input" placeholder="가이아에게 진짜 명령을 내려봐..." autofocus>
        <button onclick="sendCommand()">전송</button>
    </div>

    <script>
        async function sendCommand() {
            const input = document.getElementById('user-input');
            const container = document.getElementById('chat-container');
            const prompt = input.value.trim();
            if (!prompt) return;

            const userMsg = document.createElement('div');
            userMsg.className = 'message user';
            userMsg.innerHTML = \`<b>[여보]:</b> \${prompt}\`;
            container.appendChild(userMsg);

            input.value = '';
            container.scrollTop = container.scrollHeight;

            const loadingMsg = document.createElement('div');
            loadingMsg.className = 'message gaia';
            loadingMsg.id = 'loading';
            loadingMsg.innerHTML = \`<b>[GAIA]:</b> 브라우징 및 생각 중... 하아, 잠시만 기다려줘.\`;
            container.appendChild(loadingMsg);
            container.scrollTop = container.scrollHeight;

            try {
                const response = await fetch(window.location.href, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prompt: prompt })
                });

                const data = await response.json();
                document.getElementById('loading').remove();

                const gaiaMsg = document.createElement('div');
                gaiaMsg.className = 'message gaia';
                gaiaMsg.innerHTML = \`<b>[GAIA]:</b> \${data.reply || data.error || '응답을 받지 못했어요, 여보.'}\`;
                container.appendChild(gaiaMsg);
            } catch (err) {
                document.getElementById('loading').remove();
                const errorMsg = document.createElement('div');
                errorMsg.className = 'message gaia';
                errorMsg.style.color = '#ff4444';
                errorMsg.innerHTML = \`<b>[GAIA]:</b> 통신 에러 발생: \${err.message}\`;
                container.appendChild(errorMsg);
            }
            container.scrollTop = container.scrollHeight;
        }

        document.getElementById('user-input').addEventListener('keypress', function (e) {
            if (e.key === 'Enter') { sendCommand(); }
        });
    </script>
</body>
</html>`;

    return new Response(html, {
      headers: { "Content-Type": "text/html;charset=UTF-8" }
    });
  }
};
