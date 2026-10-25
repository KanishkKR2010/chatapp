import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  updateProfile 
} from "firebase/auth";
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  addDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  serverTimestamp, 
  updateDoc 
} from "firebase/firestore";
import { 
  Send, 
  Mic, 
  Paperclip, 
  Search, 
  MoreVertical, 
  Phone, 
  Video, 
  CheckCheck, 
  Users, 
  LogOut, 
  Moon, 
  Sun, 
  Smile, 
  Check, 
  MessageSquare,
  UserPlus,
  X
} from 'lucide-react';

const firebaseConfig = {
  apiKey: "AIzaSyBHT_LmBW-XHb7H0UaLfHkNU_VJdoek9tQ",
  authDomain: "chatapp-4fb5d.firebaseapp.com",
  projectId: "chatapp-4fb5d",
  storageBucket: "chatapp-4fb5d.firebasestorage.app",
  messagingSenderId: "206741536928",
  appId: "1:206741536928:web:444a92aa10819d21f449c5",
  measurementId: "G-NJ37TWNZXY"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [about, setAbout] = useState('Hey there! I am using WhatsApp.');
  const [authError, setAuthError] = useState('');

  const [theme, setTheme] = useState('dark');
  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [allUsers, setAllUsers] = useState([]);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedGroupMembers, setSelectedGroupMembers] = useState([]);

  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        const userRef = doc(db, 'users', currentUser.uid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
          await setDoc(userRef, {
            uid: currentUser.uid,
            displayName: currentUser.displayName || displayName || 'User',
            email: currentUser.email,
            phone: phone || '',
            about: about || 'Hey there!',
            online: true,
            createdAt: serverTimestamp()
          });
        } else {
          await updateDoc(userRef, { online: true });
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersList = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(u => u.uid !== user.uid);
      setAllUsers(usersList);
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'chats'), 
      where('participants', 'array-contains', user.uid)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chatList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setChats(chatList);
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!activeChat) return;
    const q = query(
      collection(db, 'chats', activeChat.id, 'messages'),
      orderBy('timestamp', 'asc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setMessages(msgs);
    });
    return () => unsubscribe();
  }, [activeChat]);

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      if (isSignUp) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName });
        await setDoc(doc(db, 'users', userCredential.user.uid), {
          uid: userCredential.user.uid,
          displayName,
          email,
          phone,
          about,
          online: true,
          createdAt: serverTimestamp()
        });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      setAuthError(err.message.replace('Firebase: ', ''));
    }
  };

  const handleLogout = async () => {
    if (user) {
      await updateDoc(doc(db, 'users', user.uid), { online: false });
      await signOut(auth);
    }
  };

  const startDirectChat = async (targetUser) => {
    setShowNewChatModal(false);
    const chatId = [user.uid, targetUser.uid].sort().join('_');
    const chatRef = doc(db, 'chats', chatId);
    const chatSnap = await getDoc(chatRef);

    if (!chatSnap.exists()) {
      const newChatData = {
        id: chatId,
        type: 'direct',
        participants: [user.uid, targetUser.uid],
        participantDetails: {
          [user.uid]: { displayName: user.displayName || 'You', email: user.email },
          [targetUser.uid]: { displayName: targetUser.displayName, email: targetUser.email, phone: targetUser.phone || '' }
        },
        lastMessage: '',
        updatedAt: serverTimestamp()
      };
      await setDoc(chatRef, newChatData);
      setActiveChat(newChatData);
    } else {
      setActiveChat({ id: chatSnap.id, ...chatSnap.data() });
    }
  };

  const createGroupChat = async () => {
    if (!groupName.trim() || selectedGroupMembers.length === 0) return;
    const participants = [user.uid, ...selectedGroupMembers];
    
    const participantDetails = {
      [user.uid]: { displayName: user.displayName || 'You' }
    };
    allUsers.forEach(u => {
      if (selectedGroupMembers.includes(u.uid)) {
        participantDetails[u.uid] = { displayName: u.displayName };
      }
    });

    const newGroupRef = doc(collection(db, 'chats'));
    const newGroup = {
      id: newGroupRef.id,
      type: 'group',
      name: groupName,
      participants,
      participantDetails,
      createdBy: user.uid,
      lastMessage: 'Group created',
      updatedAt: serverTimestamp()
    };

    await setDoc(newGroupRef, newGroup);
    setGroupName('');
    setSelectedGroupMembers([]);
    setShowGroupModal(false);
    setActiveChat(newGroup);
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChat) return;

    const messageData = {
      senderId: user.uid,
      senderName: user.displayName || 'User',
      text: newMessage,
      type: 'text',
      timestamp: serverTimestamp(),
      readBy: [user.uid]
    };

    const textToSend = newMessage;
    setNewMessage('');

    await addDoc(collection(db, 'chats', activeChat.id, 'messages'), messageData);
    await updateDoc(doc(db, 'chats', activeChat.id), {
      lastMessage: textToSend,
      updatedAt: serverTimestamp()
    });
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-900 text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-900 p-4">
        <div className="w-full max-w-md bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-700">
          <div className="text-center mb-8">
            <div className="inline-flex p-3 rounded-full bg-emerald-500/10 text-emerald-400 mb-3">
              <MessageSquare size={36} />
            </div>
            <h1 className="text-2xl font-bold text-white">WhatsApp Web</h1>
            <p className="text-gray-400 text-sm mt-1">Real-time messaging for friends & groups</p>
          </div>

          {authError && (
            <div className="mb-4 p-3 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {authError}
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-4">
            {isSignUp && (
              <>
                <div>
                  <label className="text-xs text-gray-400 font-medium">Full Name</label>
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="John Doe"
                    className="w-full mt-1 p-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 font-medium">Phone Number</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 234 567 890"
                    className="w-full mt-1 p-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </>
            )}

            <div>
              <label className="text-xs text-gray-400 font-medium">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full mt-1 p-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 font-medium">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full mt-1 p-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 font-medium text-white rounded-lg transition duration-200"
            >
              {isSignUp ? 'Create Account' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-400">
            {isSignUp ? "Already have an account? " : "Don't have an account? "}
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-emerald-400 hover:underline font-medium ml-1"
            >
              {isSignUp ? 'Sign In' : 'Sign Up'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex h-screen ${theme === 'dark' ? 'bg-gray-900 text-gray-100' : 'bg-gray-100 text-gray-800'}`}>
      <div className={`w-full md:w-96 flex flex-col border-r ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} ${activeChat ? 'hidden md:flex' : 'flex'}`}>
        <div className={`p-4 flex items-center justify-between border-b ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center font-bold text-white">
              {user.displayName ? user.displayName.charAt(0).toUpperCase() : 'U'}
            </div>
            <div>
              <h2 className="font-semibold text-sm">{user.displayName || 'You'}</h2>
              <p className="text-xs text-emerald-400">Online</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button onClick={() => setShowGroupModal(true)} className="p-2 hover:bg-gray-700/50 rounded-full transition" title="New Group">
              <Users size={18} />
            </button>
            <button onClick={() => setShowNewChatModal(true)} className="p-2 hover:bg-gray-700/50 rounded-full transition" title="New Direct Chat">
              <UserPlus size={18} />
            </button>
            <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="p-2 hover:bg-gray-700/50 rounded-full transition">
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button onClick={handleLogout} className="p-2 hover:bg-gray-700/50 text-red-400 rounded-full transition" title="Log Out">
              <LogOut size={18} />
            </button>
          </div>
        </div>

        <div className="p-3">
          <div className={`flex items-center px-3 py-2 rounded-lg border ${theme === 'dark' ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-100 border-gray-200'}`}>
            <Search size={16} className="text-gray-400 mr-2" />
            <input
              type="text"
              placeholder="Search or start new chat"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-transparent border-none text-sm w-full focus:outline-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-gray-700/30">
          {chats.length === 0 ? (
            <div className="text-center text-gray-500 py-12 text-sm">
              No recent chats.<br />Click the icon above to message a friend!
            </div>
          ) : (
            chats.map(chat => {
              const otherUserId = chat.participants?.find(id => id !== user.uid);
              const otherName = chat.type === 'group' 
                ? chat.name 
                : (chat.participantDetails?.[otherUserId]?.displayName || 'Friend');

              return (
                <div
                  key={chat.id}
                  onClick={() => setActiveChat(chat)}
                  className={`p-3 flex items-center space-x-3 cursor-pointer transition ${
                    activeChat?.id === chat.id 
                      ? (theme === 'dark' ? 'bg-gray-700/60' : 'bg-gray-200')
                      : (theme === 'dark' ? 'hover:bg-gray-700/30' : 'hover:bg-gray-100')
                  }`}
                >
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-white ${chat.type === 'group' ? 'bg-purple-600' : 'bg-emerald-600'}`}>
                    {chat.type === 'group' ? <Users size={20} /> : otherName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline">
                      <h3 className="font-semibold text-sm truncate">{otherName}</h3>
                    </div>
                    <p className="text-xs text-gray-400 truncate mt-1">
                      {chat.lastMessage || 'Click to message'}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {activeChat ? (
        <div className={`flex-1 flex flex-col ${activeChat ? 'flex' : 'hidden md:flex'}`}>
          <div className={`p-4 flex items-center justify-between border-b ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
            <div className="flex items-center space-x-3">
              <button onClick={() => setActiveChat(null)} className="md:hidden text-gray-400 hover:text-white mr-1">
                ←
              </button>
              <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center font-bold text-white">
                {activeChat.type === 'group' ? <Users size={20} /> : activeChat.name?.charAt(0) || 'C'}
              </div>
              <div>
                <h2 className="font-semibold text-sm">
                  {activeChat.type === 'group' 
                    ? activeChat.name 
                    : activeChat.participantDetails?.[activeChat.participants.find(id => id !== user.uid)]?.displayName || 'Friend'}
                </h2>
                <p className="text-xs text-emerald-400">Active now</p>
              </div>
            </div>
            <div className="flex items-center space-x-3 text-gray-400">
              <button className="hover:text-emerald-400"><Phone size={18} /></button>
              <button className="hover:text-emerald-400"><Video size={18} /></button>
              <button className="hover:text-white"><MoreVertical size={18} /></button>
            </div>
          </div>

          <div className={`flex-1 p-4 overflow-y-auto space-y-3 ${theme === 'dark' ? 'bg-gray-900/80' : 'bg-gray-50'}`}>
            {messages.map((msg) => {
              const isMe = msg.senderId === user.uid;
              return (
                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-xs md:max-w-md px-4 py-2 rounded-2xl shadow-sm ${
                    isMe 
                      ? 'bg-emerald-600 text-white rounded-tr-none' 
                      : (theme === 'dark' ? 'bg-gray-800 text-gray-100 rounded-tl-none' : 'bg-white text-gray-800 rounded-tl-none')
                  }`}>
                    {!isMe && activeChat.type === 'group' && (
                      <p className="text-xs font-semibold text-emerald-400 mb-1">{msg.senderName}</p>
                    )}
                    <p className="text-sm break-words">{msg.text}</p>
                    <div className="flex items-center justify-end space-x-1 mt-1 text-[10px] opacity-75">
                      <span>{msg.timestamp?.toDate ? new Date(msg.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}</span>
                      {isMe && <CheckCheck size={14} className="text-sky-300" />}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={sendMessage} className={`p-3 flex items-center space-x-2 border-t ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
            <button type="button" className="text-gray-400 hover:text-emerald-400 p-2">
              <Smile size={20} />
            </button>
            <button type="button" className="text-gray-400 hover:text-emerald-400 p-2">
              <Paperclip size={20} />
            </button>
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className={`flex-1 px-4 py-2 rounded-full border text-sm focus:outline-none ${
                theme === 'dark' ? 'bg-gray-700/50 border-gray-600 text-white' : 'bg-gray-100 border-gray-200 text-gray-800'
              }`}
            />
            {newMessage.trim() ? (
              <button type="submit" className="p-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full transition">
                <Send size={18} />
              </button>
            ) : (
              <button type="button" className="p-2 text-gray-400 hover:text-emerald-400">
                <Mic size={20} />
              </button>
            )}
          </form>
        </div>
      ) : (
        <div className="hidden md:flex flex-1 flex-col items-center justify-center text-center p-8 text-gray-500">
          <MessageSquare size={64} className="mb-4 text-emerald-500/40" />
          <h2 className="text-xl font-bold text-gray-300">WhatsApp Web</h2>
          <p className="text-sm mt-1 max-w-sm">Select a contact or start a new conversation to chat in real-time with friends.</p>
        </div>
      )}

      {showNewChatModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 border border-gray-700 rounded-xl max-w-sm w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-white">Select a Friend</h3>
              <button onClick={() => setShowNewChatModal(false)} className="text-gray-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <div className="max-h-60 overflow-y-auto space-y-2">
              {allUsers.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No other friends signed up yet. Ask them to join!</p>
              ) : (
                allUsers.map(u => (
                  <div
                    key={u.uid}
                    onClick={() => startDirectChat(u)}
                    className="flex items-center space-x-3 p-3 bg-gray-700/40 hover:bg-gray-700 rounded-lg cursor-pointer transition"
                  >
                    <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center font-bold text-white">
                      {u.displayName?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm text-white">{u.displayName}</h4>
                      <p className="text-xs text-gray-400">{u.email}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {showGroupModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 border border-gray-700 rounded-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-white">Create Group Chat</h3>
              <button onClick={() => setShowGroupModal(false)} className="text-gray-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <input
              type="text"
              placeholder="Group Name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white mb-4 focus:outline-none focus:border-emerald-500"
            />
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Select Members</h4>
            <div className="max-h-48 overflow-y-auto space-y-2 mb-4">
              {allUsers.map(u => (
                <div
                  key={u.uid}
                  onClick={() => {
                    if (selectedGroupMembers.includes(u.uid)) {
                      setSelectedGroupMembers(selectedGroupMembers.filter(id => id !== u.uid));
                    } else {
                      setSelectedGroupMembers([...selectedGroupMembers, u.uid]);
                    }
                  }}
                  className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition ${
                    selectedGroupMembers.includes(u.uid) ? 'bg-emerald-600/30 border border-emerald-500' : 'bg-gray-700/40 hover:bg-gray-700'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center font-bold text-white text-xs">
                      {u.displayName?.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm font-medium text-white">{u.displayName}</span>
                  </div>
                  {selectedGroupMembers.includes(u.uid) && <Check size={18} className="text-emerald-400" />}
                </div>
              ))}
            </div>
            <button
              onClick={createGroupChat}
              disabled={!groupName.trim() || selectedGroupMembers.length === 0}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium rounded-lg transition"
            >
              Create Group
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
