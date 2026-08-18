/* ============================================================
   Simulador de llamadas · PEI 2026 UPANA
   Controla pantallas, temporizador, Web Speech API (síntesis y
   reconocimiento) y el motor de respuestas basado en la KB.
   ============================================================ */

(() => {
  "use strict";

  /* ---------- Referencias DOM ---------- */
  const screens = {
    select: document.getElementById("screen-select"),
    ringing: document.getElementById("screen-ringing"),
    call: document.getElementById("screen-call"),
    end: document.getElementById("screen-end")
  };

  const ringingAvatar = document.getElementById("ringing-avatar");
  const ringingName = document.getElementById("ringing-name");
  const ringingKicker = document.getElementById("ringing-kicker");
  const ringingStatus = document.getElementById("ringing-status");

  const callAvatar = document.getElementById("call-avatar");
  const callName = document.getElementById("call-name");
  const callKicker = document.getElementById("call-kicker");
  const callTimerEl = document.getElementById("call-timer");

  const waveform = document.getElementById("waveform");
  const speakIndicator = document.getElementById("speak-indicator");
  const micBtn = document.getElementById("btn-talk");
  const micHint = document.getElementById("mic-hint");

  const drawer = document.getElementById("transcript-drawer");
  const drawerTitle = document.getElementById("drawer-title");
  const caseFacts = document.getElementById("case-facts");
  const transcriptEl = document.getElementById("transcript");
  const transcriptSummary = document.getElementById("transcript-summary");
  const endDuration = document.getElementById("end-duration");

  const voiceDot = document.getElementById("voice-support-dot");
  const voiceText = document.getElementById("voice-support-text");

  const drawerOverlay = document.createElement("div");
  drawerOverlay.className = "drawer-overlay";
  document.body.appendChild(drawerOverlay);

  /* ---------- Estado global de la llamada ---------- */
  let state = {
    role: null,            // "agent" | "client"
    profile: null,         // perfil aleatorio en modo B
    turnIndex: 0,          // progreso del guion en modo B
    topicsAsked: [],       // temas ya consultados en modo A
    timerSeconds: 0,
    timerHandle: null,
    muted: false,
    speakerOn: false,
    isAiTurn: false,
    transcriptLines: []
  };

  /* ---------- Soporte de voz del navegador ---------- */
  const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
  const synth = window.speechSynthesis;
  let recognizer = null;
  let spanishVoice = null;

  function pickSpanishVoice() {
    if (!synth) return;
    const voices = synth.getVoices();
    spanishVoice =
      voices.find(v => /es-GT|es-419/i.test(v.lang)) ||
      voices.find(v => /es-MX/i.test(v.lang)) ||
      voices.find(v => /^es/i.test(v.lang)) ||
      voices[0] || null;
  }
  if (synth) {
    pickSpanishVoice();
    synth.onvoiceschanged = pickSpanishVoice;
  }

  function reportVoiceSupport() {
    const hasTTS = !!synth;
    const hasSTT = !!SpeechRecognitionAPI;
    if (hasTTS && hasSTT) {
      voiceDot.classList.add("ok");
      voiceText.textContent = "Voz activada: su navegador soporta hablar y escuchar.";
    } else if (hasTTS && !hasSTT) {
      voiceDot.classList.add("bad");
      voiceText.textContent = "Su navegador solo soporta síntesis de voz. Al hablar, se usará un cuadro de texto de respaldo.";
    } else {
      voiceDot.classList.add("bad");
      voiceText.textContent = "Web Speech API no disponible. La simulación funcionará con texto de respaldo.";
    }
  }
  reportVoiceSupport();

  if (SpeechRecognitionAPI) {
    recognizer = new SpeechRecognitionAPI();
    recognizer.lang = "es-GT";
    recognizer.interimResults = false;
    recognizer.maxAlternatives = 1;
  }

  /* ---------- Utilidades de pantalla ---------- */
  function showScreen(name) {
    Object.values(screens).forEach(s => s.classList.add("hidden"));
    screens[name].classList.remove("hidden");
  }

  function speak(text, onEnd) {
    if (!synth) { onEnd && onEnd(); return; }
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "es-GT";
    if (spanishVoice) utter.voice = spanishVoice;
    utter.rate = 1;
    utter.pitch = 1;
    waveform.classList.add("active");
    speakIndicator.textContent = state.role === "agent"
      ? "Hablando: Admisiones UPANA…"
      : `Hablando: ${state.profile.nombre}…`;
    utter.onend = () => {
      waveform.classList.remove("active");
      speakIndicator.textContent = "";
      onEnd && onEnd();
    };
    utter.onerror = () => {
      waveform.classList.remove("active");
      onEnd && onEnd();
    };
    synth.speak(utter);
  }

  /* ---------- Transcripción y ficha del caso ---------- */
  function addLine(who, text) {
    state.transcriptLines.push({ who, text });
    const div = document.createElement("div");
    div.className = "tline " + (who === "ai" ? "ai" : "user");
    const label = who === "ai"
      ? (state.role === "agent" ? "Asesor UPANA" : state.profile.nombre)
      : (state.role === "agent" ? "Usted (cliente)" : "Usted (asesor)");
    div.innerHTML = `<span class="who">${label}</span>${text}`;
    transcriptEl.appendChild(div);
    transcriptEl.scrollTop = transcriptEl.scrollHeight;
  }

  function setFacts(rows) {
    caseFacts.innerHTML = "";
    rows.forEach(([k, v]) => {
      const div = document.createElement("div");
      div.innerHTML = `<dt>${k}</dt><dd>${v}</dd>`;
      caseFacts.appendChild(div);
    });
  }

  function refreshFacts() {
    if (state.role === "agent") {
      setFacts([
        ["Programa", "PEI 2026 · Ciencias Jurídicas"],
        ["Rol de la IA", "Asesor de Admisiones"],
        ["Su rol", "Cliente / interesado"],
        ["Temas consultados", state.topicsAsked.length ? state.topicsAsked.join(", ") : "—"]
      ]);
    } else {
      setFacts([
        ["Programa", "PEI 2026 · Ciencias Jurídicas"],
        ["Rol de la IA", "Estudiante interesado"],
        ["Perfil simulado", state.profile.label],
        ["Su rol", "Asesor de Admisiones"],
        ["Avance del guion", `${state.turnIndex} de ${state.profile.dudas.length + 1} intervenciones`]
      ]);
    }
  }

  /* ============================================================
     Motor de respuestas — Modo A: la IA es el Agente de Admisiones
     ============================================================ */
  const AGENT_GREETING = "¡Buen día! Gracias por comunicarse a la Universidad Panamericana, le saluda el departamento de admisiones del Programa PEI de Derecho. ¿Con quién tengo el gusto y cómo le puedo apoyar hoy?";

  function detectIntent(text) {
    const t = text.toLowerCase();
    if (/(precio|costo|cuanto|cuánto|mensualidad|pago|inversión|inversion|quetzal|cuota)/.test(t)) return "inversion";
    if (/(fase|duracion|duración|meses|tiempo|cuánto dura|cuanto dura)/.test(t)) return "duracion";
    if (/(requisito|pensum|credito|crédito|porcentaje|dpi|entrar|aplicar|inscribir)/.test(t)) return "requisitos";
    if (/(sede|campus|virtual|híbrid|hibrid|departamento|donde|dónde|ciudad|cobán|coban|quetzaltenango|jutiapa|huehuetenango)/.test(t)) return "sedes";
    if (/(horario|dia|día|sabado|sábado|jueves|viernes)/.test(t)) return "horarios";
    if (/(papel|documento|carné|carne|certificacion|certificación|antecedent)/.test(t)) return "papeleria";
    if (/(gracias|listo|eso es todo|hasta luego|adios|adiós|nada mas|nada más)/.test(t)) return "cierre";
    if (/(propósito|proposito|de que trata|de qué trata|que es el pei|qué es el pei)/.test(t)) return "proposito";
    return null;
  }

  function agentAnswer(intent) {
    switch (intent) {
      case "proposito":
        return "Con mucho gusto le explico: el PEI le permite, si viene de otra universidad, incorporarse a nuestra Facultad de Ciencias Jurídicas y Justicia para obtener la Licenciatura en Ciencias Jurídicas y de la Justicia, con sus títulos de Abogado y Notario.";
      case "requisitos":
        return `Mire, para aplicar necesitamos que tenga su pensum cerrado de Ciencias Jurídicas y Sociales, o bien una certificación de cursos aprobados con al menos el 86% del plan de estudios más su pensum de origen. También nos hace falta copia de su DPI. Eso sí, nosotros revisamos la afinidad de los cursos contra nuestro pensum.`;
      case "duracion":
        return `El programa dura 18 meses en total, organizados en tres fases de 6 meses cada una. Cada fase tiene un primer ciclo de clases y trabajos escritos, y un segundo ciclo de evaluaciones orales. Para aprobar se pide un mínimo de 80% de asistencia y nota mínima de 70 sobre 100, y si reprueba algún curso tiene derecho a recuperación.`;
      case "sedes":
        return `Tenemos dos modalidades, licenciado(a). En modalidad virtual estamos en Central, en zona 15, Naranjo, Álamos, Antigua Guatemala o Chimaltenango, Cobán, Zacapa, Petén y Mazatenango. En modalidad híbrida estamos en Naranjo, Jutiapa, Huehuetenango, Retalhuleu, Quetzaltenango, San Marcos, Coatepeque y Sololá.`;
      case "horarios":
        return `Los horarios habituales son jueves y viernes de 6 a 8 de la noche, y los sábados de 7 de la mañana a 5 de la tarde.`;
      case "papeleria":
        return `Para la inscripción final le vamos a pedir: cierre de pensum y certificación original, plan de estudios sellado, copia autenticada de su DPI, foto digital a color tamaño cédula, certificación de nacimiento, declaración jurada, fotostática de su título de diversificado tamaño 5 por 7, y carencia de antecedentes penales y policíacos.`;
      case "inversion":
        return `Le detallo la inversión: el carné tiene un pago único de ${fmtQ(KB.inversion.carne)}. La inscripción es de ${fmtQ(KB.inversion.inscripcionPorFase)} por cada fase, o sea ${fmtQ(KB.inversion.inscripcionTotal)} en total. La convalidación de cursos es un pago único de ${fmtQ(KB.inversion.convalidacion)}. En la fase de escritos, la Fase I con 5 cursos son ${fmtQ(KB.inversion.escritos["fase i"].monto)} al mes en 4 cuotas; la Fase II con 4 cursos son ${fmtQ(KB.inversion.escritos["fase ii"].monto)} al mes; y la Fase III con 3 cursos son ${fmtQ(KB.inversion.escritos["fase iii"].monto)} al mes, también en 4 cuotas. La fase de orales es de ${fmtQ(KB.inversion.orales)} por cada fase. Ya para el sistema de egreso, con la Tesis III, son ${fmtQ(KB.inversion.egreso)}, que se pueden pagar en 4 cuotas, y el acto de investidura es un pago único de ${fmtQ(KB.inversion.investidura)}.`;
      case "cierre":
        return `Con muchísimo gusto. Le recomiendo que me mande su pensum y su DPI para irle revisando su caso desde ya, y así le apartamos su cupo. ¿Le parece si agendamos su cita para que traiga sus papeles?`;
      default:
        return `Mire fíjese que con gusto le amplío esa información. ¿Me podría decir si su duda es sobre requisitos para aplicar, la duración del programa, las sedes y modalidades, los horarios, la papelería o la inversión económica?`;
    }
  }

  function topicLabel(intent) {
    const labels = {
      proposito: "Propósito del PEI", requisitos: "Requisitos", duracion: "Duración y fases",
      sedes: "Sedes y modalidad", horarios: "Horarios", papeleria: "Papelería", inversion: "Inversión", cierre: "Cierre"
    };
    return labels[intent] || null;
  }

  /* ============================================================
     Motor de respuestas — Modo B: la IA es el estudiante interesado
     ============================================================ */
  function clientNextLine() {
    const p = state.profile;
    const reaction = REACTIONS[Math.floor(Math.random() * REACTIONS.length)];
    if (state.turnIndex === 0) {
      return p.apertura; // primera intervención tras el saludo del usuario
    }
    const dudaIdx = state.turnIndex - 1;
    if (dudaIdx < p.dudas.length) {
      return `${reaction} ${p.dudas[dudaIdx]}`;
    }
    return `${reaction} ${p.cierre}`;
  }

  /* ============================================================
     Flujo de pantallas
     ============================================================ */
  document.querySelectorAll(".role-card").forEach(btn => {
    btn.addEventListener("click", () => startRinging(btn.dataset.role));
  });

  document.getElementById("btn-restart").addEventListener("click", () => {
    resetState();
    showScreen("select");
  });

  function resetState() {
    if (state.timerHandle) clearInterval(state.timerHandle);
    if (recognizer) { try { recognizer.abort(); } catch (e) {} }
    if (synth) synth.cancel();
    state = { role: null, profile: null, turnIndex: 0, topicsAsked: [], timerSeconds: 0, timerHandle: null, muted: false, speakerOn: false, isAiTurn: false, transcriptLines: [] };
    transcriptEl.innerHTML = "";
    drawer.classList.remove("open");
    drawerOverlay.classList.remove("open");
    document.getElementById("btn-mute").classList.remove("active");
    document.getElementById("btn-speaker").classList.remove("active");
    micBtn.classList.remove("recording");
    micBtn.disabled = true;
  }

  function startRinging(role) {
    resetState();
    state.role = role;
    if (role === "client") {
      state.profile = CLIENT_PROFILES[Math.floor(Math.random() * CLIENT_PROFILES.length)];
    }
    const displayName = role === "agent" ? "Admisiones UPANA" : state.profile.nombre;
    const initials = role === "agent" ? "UP" : state.profile.iniciales;
    ringingName.textContent = displayName;
    ringingAvatar.textContent = initials;
    ringingKicker.textContent = "Programa PEI · Ciencias Jurídicas";
    ringingStatus.textContent = role === "agent" ? "Llamando…" : "Llamada entrante…";
    showScreen("ringing");
  }

  document.getElementById("btn-decline").addEventListener("click", () => {
    resetState();
    showScreen("select");
  });

  document.getElementById("btn-accept").addEventListener("click", connectCall);

  function connectCall() {
    const role = state.role;
    const displayName = role === "agent" ? "Admisiones UPANA" : state.profile.nombre;
    const initials = role === "agent" ? "UP" : state.profile.iniciales;
    callName.textContent = displayName;
    callAvatar.textContent = initials;
    callKicker.textContent = "Programa PEI · Ciencias Jurídicas";
    drawerTitle.textContent = role === "agent" ? "Llamada a Admisiones UPANA" : `Llamada de ${displayName}`;

    showScreen("call");
    refreshFacts();

    state.timerSeconds = 0;
    callTimerEl.textContent = "00:00";
    state.timerHandle = setInterval(() => {
      state.timerSeconds++;
      const m = String(Math.floor(state.timerSeconds / 60)).padStart(2, "0");
      const s = String(state.timerSeconds % 60).padStart(2, "0");
      callTimerEl.textContent = `${m}:${s}`;
    }, 1000);

    if (role === "agent") {
      // La IA (asesor) saluda primero.
      micBtn.disabled = true;
      speakIndicator.textContent = "Hablando: Admisiones UPANA…";
      addLine("ai", AGENT_GREETING);
      speak(AGENT_GREETING, enableMic);
    } else {
      // El usuario (asesor) contesta y saluda primero.
      micBtn.disabled = false;
      micHint.textContent = "Su turno: salude y atienda la llamada";
      speakIndicator.textContent = "Su turno para hablar";
    }
  }

  function enableMic() {
    micBtn.disabled = false;
    micHint.textContent = "Presione para hablar";
  }

  /* ---------- Micrófono: grabar / reconocer voz ---------- */
  let recording = false;

  micBtn.addEventListener("click", () => {
    if (micBtn.disabled || state.isAiTurn) return;
    if (!recording) startRecording();
  });

  function startRecording() {
    recording = true;
    micBtn.classList.add("recording");
    micBtn.disabled = true;
    waveform.classList.add("listening");
    speakIndicator.textContent = "Escuchando…";
    micHint.textContent = "Grabando…";

    if (recognizer) {
      try {
        recognizer.start();
      } catch (e) {
        finishRecordingFallback();
        return;
      }
      recognizer.onresult = (event) => {
        const text = event.results[0][0].transcript;
        stopRecording(text);
      };
      recognizer.onerror = () => finishRecordingFallback();
      recognizer.onend = () => {
        if (recording) finishRecordingFallback();
      };
    } else {
      finishRecordingFallback();
    }
  }

  function finishRecordingFallback() {
    if (!recording) return;
    const text = window.prompt("Su navegador no reconoce voz. Escriba aquí lo que diría en la llamada:", "");
    stopRecording(text && text.trim() ? text.trim() : "Continuar.");
  }

  function stopRecording(text) {
    if (!recording) return;
    recording = false;
    micBtn.classList.remove("recording");
    waveform.classList.remove("listening");
    if (recognizer) { try { recognizer.stop(); } catch (e) {} }
    addLine("user", text);
    handleUserTurn(text);
  }

  /* ---------- Procesar el turno del usuario y responder ---------- */
  function handleUserTurn(text) {
    state.isAiTurn = true;
    micHint.textContent = "Esperando respuesta…";
    speakIndicator.textContent = "";

    setTimeout(() => {
      let reply;
      if (state.role === "agent") {
        const intent = detectIntent(text) || "generico";
        reply = agentAnswer(intent);
        const label = topicLabel(intent);
        if (label && !state.topicsAsked.includes(label)) state.topicsAsked.push(label);
      } else {
        reply = clientNextLine();
        state.turnIndex++;
      }
      addLine("ai", reply);
      refreshFacts();
      speak(reply, () => {
        state.isAiTurn = false;
        micBtn.disabled = false;
        micHint.textContent = "Presione para hablar";
      });
    }, 550);
  }

  /* ---------- Controles de llamada ---------- */
  document.getElementById("btn-mute").addEventListener("click", (e) => {
    state.muted = !state.muted;
    e.currentTarget.classList.toggle("active", state.muted);
    if (recognizer) recognizer.lang = recognizer.lang; // no-op, deja claro el estado visual
  });

  document.getElementById("btn-speaker").addEventListener("click", (e) => {
    state.speakerOn = !state.speakerOn;
    e.currentTarget.classList.toggle("active", state.speakerOn);
  });

  document.getElementById("btn-hangup").addEventListener("click", endCall);

  function endCall() {
    if (state.timerHandle) clearInterval(state.timerHandle);
    if (synth) synth.cancel();
    if (recognizer) { try { recognizer.abort(); } catch (e) {} }
    endDuration.textContent = callTimerEl.textContent;
    transcriptSummary.innerHTML = "";
    state.transcriptLines.forEach(({ who, text }) => {
      const div = document.createElement("div");
      div.className = "tline " + (who === "ai" ? "ai" : "user");
      const label = who === "ai"
        ? (state.role === "agent" ? "Asesor UPANA" : (state.profile ? state.profile.nombre : "IA"))
        : (state.role === "agent" ? "Usted (cliente)" : "Usted (asesor)");
      div.innerHTML = `<span class="who">${label}</span>${text}`;
      transcriptSummary.appendChild(div);
    });
    showScreen("end");
  }

  /* ---------- Panel lateral (drawer) ---------- */
  const btnDrawer = document.getElementById("btn-drawer");
  const btnDrawerClose = document.getElementById("btn-drawer-close");

  function openDrawer() {
    drawer.classList.add("open");
    drawerOverlay.classList.add("open");
    drawer.setAttribute("aria-hidden", "false");
    btnDrawer.setAttribute("aria-expanded", "true");
  }
  function closeDrawer() {
    drawer.classList.remove("open");
    drawerOverlay.classList.remove("open");
    drawer.setAttribute("aria-hidden", "true");
    btnDrawer.setAttribute("aria-expanded", "false");
  }
  btnDrawer.addEventListener("click", openDrawer);
  btnDrawerClose.addEventListener("click", closeDrawer);
  drawerOverlay.addEventListener("click", closeDrawer);

  /* Estado inicial */
  micBtn.disabled = true;
})();
