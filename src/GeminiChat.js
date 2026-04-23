



// src/GeminiChat.js
import { useState, useRef, useEffect } from "react";
import { signOut } from "firebase/auth";
import { auth } from "./firebase";
import Login from "./Login";
import { sendChatMessage } from "./chatAPI";
import "./GeminiChat.css";

const FREE_LIMIT = 10;

function TypingDots() {
  return (
    <div className="typing-dots">
      <span /><span /><span />
    </div>
  );
}

function Message({ msg }) {
  const cls =
    msg.role === "user" ? "msg-user" :
    msg.role === "error" ? "msg-error" : "msg-ai";

  return (
    <div className={cls}>
      {msg.typing ? <TypingDots /> : msg.text}
    </div>
  );
}

export default function GeminiChat({ user }) {
  const [messages, setMessages] = useState([
    { id: 0, role: "ai", text: "Hello! 👋 Ask me anything, I'll answer!" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [micSupported, setMicSupported] = useState(true);
  const [queryCount, setQueryCount] = useState(() =>
    parseInt(localStorage.getItem("freeQueryCount") || "0")
  );

  const chatEndRef = useRef(null);
  const recognitionRef = useRef(null);

  const queriesLeft = FREE_LIMIT - queryCount;
  const showLoginWall = !user && queriesLeft <= 0;

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Setup Speech Recognition
  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setMicSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "hi-IN"; // Hindi + English dono kaam karte hain
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setInput(transcript);
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognition.onerror = (e) => {
      console.error("Speech error:", e.error);
      setListening(false);
      if (e.error === "not-allowed") {
        alert("Mic permission do — browser settings mein jaake allow karo।");
      }
    };

    recognitionRef.current = recognition;
  }, []);

  const toggleMic = () => {
    if (!recognitionRef.current) return;

    if (listening) {
      recognitionRef.current.stop();
      setListening(false);
    } else {
      setInput("");
      recognitionRef.current.start();
      setListening(true);
    }
  };

  if (showLoginWall) {
    return <Login queriesLeft={0} />;
  }

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    if (!user && queriesLeft <= 0) return;

    // Stop mic if still listening
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
    }

    const userMsg = { id: Date.now(), role: "user", text: input.trim() };
    const typingMsg = { id: Date.now() + 1, role: "ai", typing: true };

    setMessages((prev) => [...prev, userMsg, typingMsg]);
    setInput("");
    setLoading(true);

    if (!user) {
      const newCount = queryCount + 1;
      setQueryCount(newCount);
      localStorage.setItem("freeQueryCount", newCount.toString());
    }

    try {
      const reply = await sendChatMessage(userMsg.text);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === typingMsg.id
            ? { ...m, typing: false, text: reply, role: "ai" }
            : m
        )
      );
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === typingMsg.id
            ? {
                ...m,
                typing: false,
                text: "❌ Network error. Please check your internet connection.",
                role: "error",
              }
            : m
        )
      );
    }

    setLoading(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleLogout = () => signOut(auth);

  return (
    <div className="chat-wrapper">
      <div className="chat-container">

        {/* Header */}
        <div className="chat-header">
          <div className="chat-header-icon">🤖</div>
          <div>
            <div className="chat-header-title">My AI Chatbot</div>
            <div className="chat-header-sub">Groq — Llama 3 — Hindi & English</div>
          </div>
          <div className="chat-header-right">
            <span className="online-badge">Online</span>
            {user && (
              <>
                <img
                  src="https://img.freepik.com/free-vector/cute-bot-say-users-hello-chatbot-greets-online-consultation_80328-195.jpg"
                  alt="avatar"
                  className="user-avatar"
                />
                <button className="logout-btn" onClick={handleLogout}>Logout</button>
              </>
            )}
          </div>
        </div>

        {/* Query Counter */}
        {!user && (
          <div className="query-counter">
            {queriesLeft > 0 ? (
              <>You have <strong>{queriesLeft} free {queriesLeft === 1 ? "query" : "queries"}</strong> left — log in for unlimited access</>
            ) : (
              <>⚠️ Free queries are over — <strong>Log in</strong> to continue</>
            )}
          </div>
        )}

        {/* Listening Indicator */}
        {listening && (
          <div className="listening-bar">
            <div className="listening-dot" />
          Speaking... 
          </div>
        )}

        {/* Chat Box */}
        <div className="chat-box">
          {messages.map((msg) => (
            <Message key={msg.id} msg={msg} />
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* Input Area */}
        <div className="chat-input-area">

          {/* Mic Button */}
          {micSupported && (
            <button
              className={`mic-btn ${listening ? "listening" : ""}`}
              onClick={toggleMic}
              disabled={loading || (!user && queriesLeft <= 0)}
              title={listening ? "Click to stop" : "Click to speak"}
            >
              {listening ? "🔴" : "🎤"}
            </button>
          )}

          {/* Text Input */}
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              listening
                ? "Bol raha hoon... 🎤"
                : !user && queriesLeft <= 0
                ? "Log in to continue..."
                : "Type or speak your question..."
            }
            disabled={loading || (!user && queriesLeft <= 0)}
            className="chat-textarea"
          />

          {/* Send Button */}
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim() || (!user && queriesLeft <= 0)}
            className="send-btn"
          >
            {loading ? "..." : "Send ↑"}
          </button>

        </div>
      </div>
    </div>
  );
}