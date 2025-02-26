import React, { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import CryptoJS from "crypto-js";
import "tailwindcss/tailwind.css";

interface Message {
  sender: string;
  message: string;
  timestamp: number;
  isRead: boolean;
}

interface Conversation {
  participants: string[];
  messages: Message[];
}

interface User {
  username: string;
  isOnline: boolean;
  lastActive: number;
}

const socket = io("http://localhost:8087");
const SECRET_KEY = "31a2d82a7a57e91421495198438d2c8e";

const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const formatLastSeen = (timestamp: number): string => {
  const now = new Date();
  const lastActive = new Date(timestamp);
  const diffMs = now.getTime() - lastActive.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  } else if (diffHours > 0) {
    return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  } else if (diffMins > 0) {
    return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
  } else {
    return "Just now";
  }
};

const encryptMessage = (message: string): string => {
  return CryptoJS.AES.encrypt(message, SECRET_KEY).toString();
};

const decryptMessage = (encryptedMessage: string): string => {
  const bytes = CryptoJS.AES.decrypt(encryptedMessage, SECRET_KEY);
  return bytes.toString(CryptoJS.enc.Utf8);
};

const App: React.FC = () => {
  const [username, setUsername] = useState<string>("");
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [users, setUsers] = useState<User[]>([]);
  const [message, setMessage] = useState<string>("");
  const [conversations, setConversations] = useState<{
    [key: string]: Conversation;
  }>({});
  const [typing, setTyping] = useState<string | null>(null);
  const [selectedReceiver, setSelectedReceiver] = useState<string>("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const typingTimeoutRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const activityTimeoutRef = useRef<any>(null);

  const getConversationId = (user1: string, user2: string): string => {
    return [user1, user2].sort().join("_");
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const updateActivity = () => {
    socket.emit("userActivity");

    socket.emit("setStatus", { status: "online" });

    if (activityTimeoutRef.current) {
      clearTimeout(activityTimeoutRef.current);
    }

    activityTimeoutRef.current = setTimeout(
      () => {
        socket.emit("setStatus", { status: "offline" });
      },
      5 * 60 * 1000
    );
  };

  const markAsRead = (sender: string) => {
    const conversationId = getConversationId(username, sender);

    setConversations((prev) => {
      const conversation = prev[conversationId];
      if (!conversation) return prev;

      return {
        ...prev,
        [conversationId]: {
          ...conversation,
          messages: conversation.messages.map((msg) =>
            msg.sender === sender ? { ...msg, isRead: true } : msg
          ),
        },
      };
    });

    socket.emit("messageRead", { sender, receiver: username, conversationId });
  };

  useEffect(() => {
    scrollToBottom();
  }, [conversations, selectedReceiver]);

  useEffect(() => {
    window.addEventListener("mousemove", updateActivity);
    window.addEventListener("keydown", updateActivity);
    window.addEventListener("click", updateActivity);

    socket.on("usersList", (usersList: User[]) => {
      setUsers(usersList.filter((user) => user.username !== username));
    });

    socket.on(
      "receiveMessage",
      ({
        sender,
        encryptedMessage,
        timestamp,
        conversationId,
      }: {
        sender: string;
        encryptedMessage: string;
        timestamp: number;
        conversationId: string;
      }) => {
        const decryptedMessage = decryptMessage(encryptedMessage);

        setConversations((prev) => {
          const conversation = prev[conversationId] || {
            participants: [username, sender],
            messages: [],
          };

          return {
            ...prev,
            [conversationId]: {
              ...conversation,
              messages: [
                ...conversation.messages,
                {
                  sender,
                  message: decryptedMessage,
                  timestamp,
                  isRead: false,
                },
              ],
            },
          };
        });

        if (sender === selectedReceiver) {
          markAsRead(sender);
        }
      }
    );

    socket.on(
      "conversationHistory",
      ({
        conversationId,
        messages,
      }: {
        conversationId: string;
        messages: {
          sender: string;
          receiver: string;
          encryptedMessage: string;
          timestamp: number;
        }[];
      }) => {
        const [user1, user2] = conversationId.split("_");
        const participants = [user1, user2];

        const decryptedMessages = messages.map((msg) => ({
          sender: msg.sender,
          message: decryptMessage(msg.encryptedMessage),
          timestamp: msg.timestamp,
          isRead: true,
        }));

        setConversations((prev) => ({
          ...prev,
          [conversationId]: {
            participants,
            messages: decryptedMessages,
          },
        }));
      }
    );

    socket.on(
      "userTyping",
      ({ sender, isTyping }: { sender: string; isTyping: boolean }) => {
        if (isTyping) {
          setTyping(`${sender} is typing...`);
        } else {
          setTyping(null);
        }
      }
    );

    socket.on(
      "messageStatus",
      ({
        status,
        conversationId,
      }: {
        reader: string;
        status: string;
        conversationId: string;
      }) => {
        if (status === "read") {
          setConversations((prev) => {
            const conversation = prev[conversationId];
            if (!conversation) return prev;

            return {
              ...prev,
              [conversationId]: {
                ...conversation,
                messages: conversation.messages.map((msg) =>
                  msg.sender === username ? { ...msg, isRead: true } : msg
                ),
              },
            };
          });
        }
      }
    );

    return () => {
      socket.off("usersList");
      socket.off("receiveMessage");
      socket.off("conversationHistory");
      socket.off("userTyping");
      socket.off("messageStatus");
      window.removeEventListener("mousemove", updateActivity);
      window.removeEventListener("keydown", updateActivity);
      window.removeEventListener("click", updateActivity);

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      if (activityTimeoutRef.current) {
        clearTimeout(activityTimeoutRef.current);
      }
    };
  }, [username, selectedReceiver]);

  useEffect(() => {
    if (selectedReceiver && username) {
      const conversationId = getConversationId(username, selectedReceiver);

      socket.emit("getConversation", {
        user1: username,
        user2: selectedReceiver,
        conversationId,
      });

      const conversation = conversations[conversationId];
      if (conversation) {
        const unreadMessages = conversation.messages.filter(
          (msg) => msg.sender === selectedReceiver && !msg.isRead
        );

        if (unreadMessages.length > 0) {
          markAsRead(selectedReceiver);
        }
      }
    }
  }, [selectedReceiver]);

  const handleLogin = () => {
    if (username.trim() === "") return;
    socket.emit("userJoined", username);
    setIsLoggedIn(true);
    updateActivity();
  };

  const sendMessage = () => {
    if (!message || !selectedReceiver) return;

    const currentTime = Date.now();
    const encryptedMessage = encryptMessage(message);
    const conversationId = getConversationId(username, selectedReceiver);

    socket.emit("sendMessage", {
      sender: username,
      receiver: selectedReceiver,
      encryptedMessage,
      conversationId,
    });

    setConversations((prev) => {
      const conversation = prev[conversationId] || {
        participants: [username, selectedReceiver],
        messages: [],
      };

      return {
        ...prev,
        [conversationId]: {
          ...conversation,
          messages: [
            ...conversation.messages,
            {
              sender: username,
              message,
              timestamp: currentTime,
              isRead: false,
            },
          ],
        },
      };
    });

    setMessage("");
    updateActivity();
  };

  const handleTyping = () => {
    if (selectedReceiver) {
      socket.emit("typing", { sender: username, receiver: selectedReceiver });
      updateActivity();
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-r from-blue-500 to-purple-600 p-4">
        <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
          <h1 className="text-3xl font-bold mb-6 text-center text-gray-800">
            Secure Chat
          </h1>
          <input
            type="text"
            placeholder="Enter your username"
            className="border border-gray-300 p-3 rounded-lg mb-4 w-full focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          />
          <button
            onClick={handleLogin}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-3 rounded-lg w-full font-semibold transition transform hover:scale-105"
          >
            Join Chat
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <div className="w-1/4 bg-white shadow-md">
        <div className="p-4 bg-blue-600 text-white">
          <h2 className="font-bold text-xl">Online Users</h2>
          <p className="text-sm mt-1">Welcome, {username}!</p>
        </div>
        <div className="p-2">
          {users.length === 0 ? (
            <p className="text-gray-500 p-3 text-center">No users available</p>
          ) : (
            <ul>
              {users.map((user, index) => (
                <li
                  key={index}
                  className={`p-3 rounded-lg mb-1 cursor-pointer transition-all flex items-center justify-between ${
                    selectedReceiver === user.username
                      ? "bg-blue-100 border-l-4 border-blue-500"
                      : "hover:bg-gray-100"
                  }`}
                  onClick={() => setSelectedReceiver(user.username)}
                >
                  <div className="flex items-center">
                    <span
                      className={`h-3 w-3 rounded-full mr-2 ${user.isOnline ? "bg-green-500" : "bg-gray-400"}`}
                    ></span>
                    <span className="font-medium">{user.username}</span>
                  </div>
                  {!user.isOnline && (
                    <span className="text-xs text-gray-500">
                      Last seen: {formatLastSeen(user.lastActive)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        <div className="p-4 border-b bg-white shadow-sm flex items-center">
          {selectedReceiver ? (
            <>
              <div className="flex items-center">
                <div className="w-10 h-10 rounded-full bg-blue-200 flex items-center justify-center text-blue-700 font-bold mr-3">
                  {selectedReceiver.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="font-bold text-lg">{selectedReceiver}</h2>
                  {typing && (
                    <div className="text-gray-500 text-sm italic">{typing}</div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <h2 className="font-bold text-lg text-gray-500">
              Select a user to start chatting
            </h2>
          )}
        </div>

        <div className="flex-1 p-4 overflow-y-auto bg-gray-50">
          {selectedReceiver &&
            conversations[getConversationId(username, selectedReceiver)] &&
            conversations[
              getConversationId(username, selectedReceiver)
            ].messages.map((msg, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg mb-3 max-w-sm ${
                  msg.sender === username
                    ? "bg-blue-500 text-white ml-auto"
                    : "bg-white border border-gray-200 mr-auto"
                }`}
              >
                <div className="text-sm mb-1 flex justify-between items-center">
                  <span
                    className={`font-bold ${msg.sender === username ? "text-blue-100" : "text-gray-600"}`}
                  >
                    {msg.sender}
                  </span>
                  <span
                    className={`text-xs ${msg.sender === username ? "text-blue-100" : "text-gray-500"}`}
                  >
                    {formatTime(msg.timestamp)}
                  </span>
                </div>
                <div className="mb-1">{msg.message}</div>
                {msg.sender === username && (
                  <div className="text-xs text-right text-blue-100">
                    {msg.isRead ? "✓✓ Read" : "✓ Sent"}
                  </div>
                )}
              </div>
            ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-3 border-t bg-white flex items-center">
          <input
            type="text"
            placeholder={
              selectedReceiver
                ? `Message ${selectedReceiver}...`
                : "Select a user first"
            }
            value={message}
            className="border border-gray-300 p-3 rounded-lg flex-1 mr-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            onChange={(e) => setMessage(e.target.value)}
            onKeyUp={handleTyping}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            disabled={!selectedReceiver}
          />
          <button
            onClick={sendMessage}
            className={`px-4 py-3 rounded-lg font-semibold transition ${
              !selectedReceiver
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : "bg-blue-500 hover:bg-blue-600 text-white"
            }`}
            disabled={!selectedReceiver}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;
