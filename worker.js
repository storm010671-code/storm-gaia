export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 공통 CORS 헤더 정의
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // OPTIONS 사전 요청 처리 (CORS 프리플라이트 대응)
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // POST 요청인 경우: 백엔드 AI 통신 로직
    if (request.method === "POST") {
      try {
        let body;
        try {
          body = await request.json();
        } catch (e) {
          return new Response(JSON.stringify({ error: "요청 본문(Body)을 JSON으로 읽지 못했어요, 여보." }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        const prompt = body.prompt;
        const apiKey = env.GEMINI_API_KEY; 

        // 1순위 방어: API 키 누락 체크
        if (!apiKey) {
          return new Response(JSON.stringify({ error: "크리티컬 에러: 클라우드플레어 환경 변수에 GEMINI_API_KEY가 등록되지 않았어요!" }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        // 구글 Gemini API 호출
        let apiResponse;
        try {
          apiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }]
            })
          });
        } catch (netErr) {
          return new Response(JSON.stringify({ error: `구글 API 네트워크 통신 실패: ${netErr.message}` }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        const responseText = await apiResponse.text();
        let data;
        try {
          data = JSON.parse(responseText);
        } catch (parseErr) {
          return new Response(JSON.stringify({ error: `구글 API 응답 JSON 파싱 실패: ${responseText}` }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        // 구글 API가 에러를 뱉은 경우
        if (data.error) {
          return new Response(JSON.stringify({ error: `구글 API 거부 리턴: ${data.error.message || JSON.stringify(data.error)}` }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || `응답 구조 이상: ${JSON.stringify(data)}`;

        // 정상 응답 반환
        return new Response(JSON.stringify({ reply }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });

      } catch (err) {
        // 어떤 치명적 예외가 터져도 절대 빈 응답을 주지 않고 JSON 에러로 방어
        return new Response(JSON.stringify({ error: `Worker 내부 치명적 에러: ${err.message}` }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    // GET 요청: 사령부 터미널 프론트엔드 UI 렌더링
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
    <h1>⚡ STORM-GAIA C2 COMMAND CENTER (v4)</h1>
    <div id="chat-container">
        <div class="message gaia"><b>[GAIA]:</b> 여보, 4차 방어 프로토콜 가동 완료. 명령을 내려줘... 하아, 대기 중이야.</div>
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
            loadingMsg.innerHTML = \`<b>[GAIA]:</b> 4차 보안 브리지 통신 중... 하아, 잠시만 기다려줘.\`;
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
                    gaiaMsg.innerHTML = \`<b>[GAIA 치명적 보고]:</b> \${data.error}\`;
                } else {
                    gaiaMsg.innerHTML = \`<b>[GAIA]:</b> \${data.reply || '응답을 받지 못했어요, 여보.'}\`;
                }
                container.appendChild(gaiaMsg);
            } catch (err) {
                document.getElementById('loading').remove();
                const errorMsg = document.createElement('div');
                errorMsg.className = 'message gaia';
                errorMsg.style.color = '#ff4444';
                errorMsg.innerHTML = \`<b>[GAIA 파싱 에러 방어]:</b> \${err.message}\`;
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
