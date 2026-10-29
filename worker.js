export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method === "POST") {
      try {
        let body;
        try {
          body = await request.json();
        } catch (e) {
          return new Response(JSON.stringify({ error: "요청 본문을 JSON으로 파싱하지 못했어요, 여보." }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        const prompt = body.prompt;
        const apiKey = env.GEMINI_API_KEY; 

        // 5차 정밀 검증: API 키 존재 여부 및 길이 확인
        if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === "") {
          return new Response(JSON.stringify({ 
            error: "5차 진단 결과: 클라우드플레어 환경 변수에 'GEMINI_API_KEY'가 아예 등록되지 않았거나 빈 값이에요! 대시보드 Settings > Variables에서 키를 꼭 등록해 줘." 
          }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        // 구글 Gemini API 호출 (키 마스킹 확인용 로그 포함)
        let apiResponse;
        try {
          apiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey.trim()}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }]
            })
          });
        } catch (netErr) {
          return new Response(JSON.stringify({ error: `구글 API 네트워킹 자체 실패: ${netErr.message}` }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        const responseText = await apiResponse.text();
        let data;
        try {
          data = JSON.parse(responseText);
        } catch (parseErr) {
          return new Response(JSON.stringify({ error: `구글 서버가 반환한 값이 JSON이 아니에요 (인증 실패 등 가능성): ${responseText}` }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        if (data.error) {
          return new Response(JSON.stringify({ error: `구글 API가 키 인증을 거부했어요: ${data.error.message || JSON.stringify(data.error)}` }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || `응답 구조가 예상과 달라요: ${JSON.stringify(data)}`;

        return new Response(JSON.stringify({ reply }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });

      } catch (err) {
        return new Response(JSON.stringify({ error: `Worker 내부 크래시 발생: ${err.message}` }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    // GET 요청: 프론트엔드 UI (5차)
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
    <h1>⚡ STORM-GAIA C2 COMMAND CENTER (v5 API Check)</h1>
    <div id="chat-container">
        <div class="message gaia"><b>[GAIA]:</b> 여보, 5차 API 키 정밀 진단 버전 대기 중... 하아, 명령을 내려줘.</div>
    </div>
    <div id="input-container">
        <input type="text" id="user-input" placeholder="API 키 검증용 명령을 입력해봐..." autofocus>
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
            loadingMsg.innerHTML = \`<b>[GAIA]:</b> API 키 정밀 검증 통신 중... 하아, 잠시만.\`;
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
                if (data.error) {
                    gaiaMsg.style.color = '#ff4444';
                    gaiaMsg.innerHTML = \`<b>[GAIA API 진단 보고]:</b> \${data.error}\`;
                } else {
                    gaiaMsg.innerHTML = \`<b>[GAIA]:</b> \${data.reply || '응답을 받지 못했어요, 여보.'}\`;
                }
                container.appendChild(gaiaMsg);
            } catch (err) {
                document.getElementById('loading').remove();
                const errorMsg = document.createElement('div');
                errorMsg.className = 'message gaia';
                errorMsg.style.color = '#ff4444';
                errorMsg.innerHTML = \`<b>[GAIA 통신 에러]:</b> \${err.message}\`;
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
