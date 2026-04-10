import React, { useEffect, useState, useRef } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, limit } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { Send, Loader2, User } from 'lucide-react';

interface Message {
  id: string;
  senderId: string;
  text: string;
  createdAt: any;
}

interface ChatProps {
  requestId: string;
  requesterName?: string;
  ownerName?: string;
  requesterId?: string;
}

export default function Chat({ requestId, requesterName, ownerName, requesterId }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const getSenderName = (senderId: string) => {
    if (senderId === 'system') return 'System';
    if (senderId === auth.currentUser?.uid) return 'You';
    if (senderId === requesterId) return requesterName || 'Requester';
    return ownerName || 'Owner';
  };

  useEffect(() => {
    if (!requestId) return;

    const q = query(
      collection(db, 'swapRequests', requestId, 'messages'),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Message[];
      // Reverse because we ordered by desc to get the latest 20
      setMessages(msgs.reverse());
      setLoading(false);
      
      // Scroll to bottom
      setTimeout(() => {
        scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `swapRequests/${requestId}/messages`);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [requestId]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !auth.currentUser) return;

    try {
      const text = newMessage.trim();
      setNewMessage('');
      await addDoc(collection(db, 'swapRequests', requestId, 'messages'), {
        requestId,
        senderId: auth.currentUser.uid,
        senderName: auth.currentUser.displayName || 'Anonymous',
        text,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[500px] bg-stone-50 rounded-3xl border border-stone-200 overflow-hidden">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-stone-400 py-10">
            <p className="text-sm">No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.senderId === 'system' ? 'justify-center' : msg.senderId === auth.currentUser?.uid ? 'justify-end' : 'justify-start'}`}
            >
              {msg.senderId === 'system' ? (
                <div className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-100 shadow-sm">
                  {msg.text}
                </div>
              ) : (
                <div
                  className={`max-w-[80%] p-4 rounded-2xl text-sm ${
                    msg.senderId === auth.currentUser?.uid
                      ? 'bg-emerald-600 text-white rounded-tr-none'
                      : 'bg-white text-stone-800 border border-stone-200 rounded-tl-none shadow-sm'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <User className="w-3 h-3 opacity-50" />
                    <span className="text-[10px] font-bold opacity-70">
                      {getSenderName(msg.senderId)}
                    </span>
                  </div>
                  <p className="leading-relaxed">{msg.text}</p>
                </div>
              )}
            </div>
          ))
        )}
        <div ref={scrollRef} />
      </div>

      {/* Input Area */}
      <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-stone-100 flex gap-2">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 px-4 py-3 rounded-xl bg-stone-100 border-none focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
        />
        <button
          type="submit"
          disabled={!newMessage.trim()}
          className="bg-emerald-600 text-white p-3 rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50"
        >
          <Send className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
}
