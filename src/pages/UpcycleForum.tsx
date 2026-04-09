import React, { useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, doc, serverTimestamp, arrayUnion, arrayRemove, increment, getDocs, limit } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, MessageSquare, Share2, Plus, X, Image as ImageIcon, Video, Loader2, Send, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

interface UpcycleComment {
  id: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: any;
}

interface UpcyclePost {
  id: string;
  userId: string;
  userName: string;
  title: string;
  description: string;
  imageUrl: string;
  videoUrl?: string;
  likes: number;
  likedBy: string[];
  commentsCount: number;
  createdAt: any;
}

function CommentSection({ postId, onClose }: { postId: string; onClose: () => void }) {
  const [comments, setComments] = useState<UpcycleComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query(collection(db, 'upcyclePosts', postId, 'comments'), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const commentsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as UpcycleComment[];
      setComments(commentsData);
      setLoading(false);
      setTimeout(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
      }, 100);
    });
    return () => unsubscribe();
  }, [postId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !newComment.trim()) return;
    setSubmitting(true);

    try {
      await addDoc(collection(db, 'upcyclePosts', postId, 'comments'), {
        userId: auth.currentUser.uid,
        userName: auth.currentUser.displayName || 'Anonymous',
        text: newComment.trim(),
        createdAt: serverTimestamp()
      });
      await updateDoc(doc(db, 'upcyclePosts', postId), {
        commentsCount: increment(1)
      });
      setNewComment('');
    } catch (error) {
      console.error("Error adding comment:", error);
      toast.error('Failed to add comment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
    >
      <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden relative z-10 flex flex-col max-h-[80vh]">
        <div className="p-6 border-b border-stone-100 flex items-center justify-between bg-stone-50">
          <h3 className="font-black text-stone-900 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-emerald-600" />
            Comments
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-stone-200 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
            </div>
          ) : comments.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-stone-400 font-medium italic">No comments yet. Be the first to share your thoughts!</p>
            </div>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center text-stone-600 font-bold text-xs shrink-0">
                  {comment.userName[0]}
                </div>
                <div className="bg-stone-50 p-4 rounded-2xl flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-stone-900 text-sm">{comment.userName}</span>
                    <span className="text-[10px] text-stone-400 font-medium">
                      {comment.createdAt?.seconds ? formatDistanceToNow(comment.createdAt.seconds * 1000) + ' ago' : 'Just now'}
                    </span>
                  </div>
                  <p className="text-stone-600 text-sm leading-relaxed">{comment.text}</p>
                </div>
              </div>
            ))
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-6 border-t border-stone-100 bg-stone-50">
          <div className="relative">
            <input
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Write a comment..."
              className="w-full pl-6 pr-14 py-4 bg-white border border-stone-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-medium"
            />
            <button
              type="submit"
              disabled={submitting || !newComment.trim()}
              className="absolute right-2 top-2 bottom-2 px-4 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 disabled:opacity-50 transition-all"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </form>
      </div>
    </motion.div>
  );
}

export default function UpcycleForum({ onModalToggle }: { onModalToggle?: (show: boolean) => void }) {
  const [posts, setPosts] = useState<UpcyclePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeCommentsPostId, setActiveCommentsPostId] = useState<string | null>(null);
  const [newPost, setNewPost] = useState({ title: '', description: '', imageUrl: '', videoUrl: '' });
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (onModalToggle) {
      onModalToggle(showCreateModal || !!activeCommentsPostId);
    }
  }, [showCreateModal, activeCommentsPostId, onModalToggle]);

  useEffect(() => {
    const q = query(collection(db, 'upcyclePosts'), orderBy('createdAt', 'desc'), limit(20));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const postsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as UpcyclePost[];
      setPosts(postsData);
      setLoading(false);
    }, (error) => {
      console.error("Upcycle Forum Snapshot Error:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLike = async (postId: string, likedBy: string[]) => {
    if (!auth.currentUser) return;
    const userId = auth.currentUser.uid;
    const postRef = doc(db, 'upcyclePosts', postId);
    const isLiked = likedBy.includes(userId);

    try {
      await updateDoc(postRef, {
        likes: isLiked ? likedBy.length - 1 : likedBy.length + 1,
        likedBy: isLiked ? arrayRemove(userId) : arrayUnion(userId)
      });
    } catch (error) {
      console.error("Error liking post:", error);
    }
  };

  const handleShare = (post: UpcyclePost) => {
    const shareUrl = `${window.location.origin}/upcycle?post=${post.id}`;
    if (navigator.share) {
      navigator.share({
        title: post.title,
        text: post.description,
        url: shareUrl,
      }).catch(console.error);
    } else {
      navigator.clipboard.writeText(shareUrl);
      toast.success('Link copied to clipboard! 🔗');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewPost(prev => ({ ...prev, imageUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !newPost.title || !newPost.imageUrl) return;
    setUploading(true);

    try {
      await addDoc(collection(db, 'upcyclePosts'), {
        userId: auth.currentUser.uid,
        userName: auth.currentUser.displayName || 'Anonymous',
        title: newPost.title,
        description: newPost.description,
        imageUrl: newPost.imageUrl,
        videoUrl: newPost.videoUrl,
        likes: 0,
        likedBy: [],
        commentsCount: 0,
        createdAt: serverTimestamp()
      });
      setShowCreateModal(false);
      setNewPost({ title: '', description: '', imageUrl: '', videoUrl: '' });
      toast.success('Project shared successfully! 🎉');
    } catch (error) {
      console.error("Error creating post:", error);
      toast.error('Failed to share project. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {!showCreateModal && (
        <header className="flex items-center justify-between mb-12">
          <div>
            <h1 className="text-4xl font-bold text-stone-900 tracking-tight">Upcycling DIY Forum</h1>
            <p className="text-stone-500 mt-2">Share your creative transformations with the Chennai community</p>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowCreateModal(true)}
            className="bg-emerald-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all"
          >
            <Plus className="w-5 h-5" />
            Share Project
          </motion.button>
        </header>
      )}

      {!showCreateModal && (
        loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-10 h-10 text-emerald-600 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {posts.map((post) => (
              <motion.div
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                key={post.id}
                className="bg-white rounded-3xl overflow-hidden border border-stone-200 shadow-sm hover:shadow-xl transition-all group"
              >
                <div className="relative aspect-square overflow-hidden bg-stone-100">
                  <img 
                    src={post.imageUrl} 
                    alt={post.title} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute top-4 left-4">
                    <span className="bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider text-stone-600 shadow-sm">
                      DIY Project
                    </span>
                  </div>
                </div>

                <div className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold">
                      {post.userName[0]}
                    </div>
                    <div>
                      <h3 className="font-bold text-stone-900">{post.userName}</h3>
                      <p className="text-xs text-stone-400">
                        {post.createdAt?.seconds ? formatDistanceToNow(post.createdAt.seconds * 1000) + ' ago' : 'Just now'}
                      </p>
                    </div>
                  </div>

                  <h2 className="text-xl font-bold text-stone-900 mb-2">{post.title}</h2>
                  <p className="text-stone-600 text-sm line-clamp-3 mb-6 leading-relaxed">
                    {post.description}
                  </p>

                  <div className="flex items-center justify-between pt-4 border-t border-stone-100">
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={() => handleLike(post.id, post.likedBy)}
                        className={`flex items-center gap-1.5 transition-colors ${
                          post.likedBy.includes(auth.currentUser?.uid || '') ? 'text-rose-500' : 'text-stone-400 hover:text-rose-500'
                        }`}
                      >
                        <Heart className={`w-5 h-5 ${post.likedBy.includes(auth.currentUser?.uid || '') ? 'fill-current' : ''}`} />
                        <span className="text-sm font-bold">{post.likes}</span>
                      </button>
                      <button 
                        onClick={() => setActiveCommentsPostId(post.id)}
                        className="flex items-center gap-1.5 text-stone-400 hover:text-emerald-600 transition-colors"
                      >
                        <MessageSquare className="w-5 h-5" />
                        <span className="text-sm font-bold">{post.commentsCount || 0}</span>
                      </button>
                    </div>
                    <button 
                      onClick={() => handleShare(post)}
                      className="text-stone-400 hover:text-stone-600 transition-colors"
                    >
                      <Share2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )
      )}

      {/* Comment Section Modal */}
      <AnimatePresence>
        {activeCommentsPostId && (
          <CommentSection 
            postId={activeCommentsPostId} 
            onClose={() => setActiveCommentsPostId(null)} 
          />
        )}
      </AnimatePresence>

      {/* Create Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCreateModal(false)}
              className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden relative z-10 flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-stone-100 flex items-center justify-between bg-stone-50 shrink-0">
                <h2 className="text-xl font-bold text-stone-900">Share Your DIY Project</h2>
                <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-stone-200 rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto">
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="aspect-video bg-stone-100 rounded-2xl border-2 border-dashed border-stone-200 flex flex-col items-center justify-center cursor-pointer hover:bg-stone-200 transition-all overflow-hidden"
                >
                  <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
                  {newPost.imageUrl ? (
                    <img src={newPost.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <>
                      <ImageIcon className="w-10 h-10 text-stone-400 mb-2" />
                      <p className="text-sm font-bold text-stone-500">Add Project Photo</p>
                    </>
                  )}
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-1 block">Project Title</label>
                    <input
                      required
                      value={newPost.title}
                      onChange={(e) => setNewPost(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="e.g., Old Tire to Garden Planter"
                      className="w-full p-4 bg-stone-50 border border-stone-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-1 block">How did you make it?</label>
                    <textarea
                      required
                      value={newPost.description}
                      onChange={(e) => setNewPost(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Describe the process and materials used..."
                      rows={4}
                      className="w-full p-4 bg-stone-50 border border-stone-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 transition-all resize-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={uploading || !newPost.imageUrl || !newPost.title}
                  className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold hover:bg-emerald-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-100"
                >
                  {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                  Post to Community
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

