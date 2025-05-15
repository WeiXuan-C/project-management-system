'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Filter, Search, SortAsc, Grid3X3, List, Moon, Sun, Bookmark, Heart, MessageSquare, MoreHorizontal, ThumbsUp, Calendar, Clock, Tag, Pin, PinOff, Star, ChevronDown, Pen, Trash2, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useDispatch, useSelector } from 'react-redux';
import { fetchPostsByTeamId, togglePostPin } from '@/lib/redux/features/postsSlice';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import HandlePost from './HandlePost';
import { useConfirm } from '@/hooks/use-confirm';
import { api } from '@/lib/api';
import { RichEditor } from '@/components/ui/rich-editor';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Smile, Paperclip, Check } from 'lucide-react';

export default function TaskPosts({ projectId, teamId, teamCFId }) {
  const t = useTranslations('PostsView');
  const dispatch = useDispatch();
  const params = useParams();
  const user = useSelector(state => state.users.currentUser);
  const [themeColor, setThemeColor] = useState('#64748b')
  const project = useSelector(state => 
    state.projects.projects.find(p => String(p.id) === String(projectId))
  );
  const { confirm } = useConfirm();
  const [userMap, setUserMap] = useState({});
  
  // 获取颜色的十六进制代码
  const getColorHexCode = (colorName) => {
    const colorMap = {
      'red': '#c72c41',
      'orange': '#d76d2b',
      'green': '#008000',
      'blue': '#3b6dbf',
      'purple': '#5c4b8a',
      'pink': '#d83c5e',
      'lightGreen': '#bbf7d0',
      'lightYellow': '#fefcbf',
      'lightCoral': '#f08080',
      'lightOrange': '#ffedd5',
      'peach': '#ffcccb',
      'lightCyan': '#e0ffff',
    };
    
    // 如果是颜色名称，返回对应的十六进制，否则返回原始值（可能已经是十六进制）
    return colorMap[colorName] || colorName;
  };
  
  // State for UI
  const [isLoading, setIsLoading] = useState(true);
  const [posts, setPosts] = useState([]);
  const [viewMode, setViewMode] = useState('list'); // list as default (changed from 'grid')
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState('newest');
  const [selectedSection, setSelectedSection] = useState('all');
  const [sections, setSections] = useState([]);
  const [pinnedPosts, setPinnedPosts] = useState(new Set());
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showInlineEditor, setShowInlineEditor] = useState(false);
  const [newPostTitle, setNewPostTitle] = useState('');
  const [newPostDescription, setNewPostDescription] = useState('');
  const [newPostContent, setNewPostContent] = useState('');
  const [postType, setPostType] = useState('post'); // 'post' or 'announcement'
  const [isFormValid, setIsFormValid] = useState(false);
  const [expandedPosts, setExpandedPosts] = useState({});
  
  // 添加内联编辑器的引用
  const inlineEditorRef = useRef(null);
  
  // Hook into data handlers
  const { 
    CreatePost, 
    UpdatePost, 
    DeletePost, 
    TogglePostPin, 
    ReactToPost, 
    CommentOnPost 
  } = HandlePost({ teamId });
  
  useEffect(() => {
    if (project?.theme_color) {
      setThemeColor(project.theme_color);
    }
  }, [project]);
  
  // Fetch users for avatars
  const fetchUserById = async (userId) => {
    try {
      // If already fetched, return from cache
      if (userMap[userId]) return;
      
      const response = await api.users.getById(userId);
      if (response.success && response.data) {
        setUserMap(prev => ({
          ...prev,
          [userId]: response.data
        }));
      }
    } catch (error) {
      console.error('Failed to fetch user:', error);
    }
  };
  
  // Fetch posts
  useEffect(() => {
    async function fetchPosts() {
      if (!teamId) return;
      
      setIsLoading(true);
      
      try {
        // Fetch all posts for this team
        const postsData = await dispatch(fetchPostsByTeamId(teamId)).unwrap();
        
        // Initialize pinned posts
        const initialPinnedPosts = new Set();
        postsData.forEach(post => {
          if (post.is_pinned) {
            initialPinnedPosts.add(post.id);
          }
          
          // Fetch user data for each post creator
          if (post.created_by) {
            fetchUserById(post.created_by);
          }
        });
        setPinnedPosts(initialPinnedPosts);
        
        // Set the posts
        setPosts(postsData);
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to fetch data:', error);
        setIsLoading(false);
      }
    }
    
    fetchPosts();
  }, [teamId, dispatch]);
  
  // Toggle pin status for a post
  const togglePinPost = async (postId) => {
    try {
      // Update pin status in the backend
      const updatedPost = await TogglePostPin(postId);
      
      if (updatedPost) {
        // Update the UI state
        setPinnedPosts(prev => {
          const newPinned = new Set(prev);
          if (updatedPost.is_pinned) {
            newPinned.add(postId);
          } else {
            newPinned.delete(postId);
          }
          return newPinned;
        });
        
        // Update post in the posts array
        setPosts(prev => 
          prev.map(post => 
            post.id === postId 
              ? { ...post, is_pinned: updatedPost.is_pinned } 
              : post
          )
        );
      }
    } catch (error) {
      console.error("Error toggling pin status:", error);
    }
  };
  
  // Filter and sort posts based on current settings
  const filteredAndSortedPosts = posts
    .filter(post => {
      // Apply section filter
      if (selectedSection !== 'all' && post.section_id !== selectedSection) {
        return false;
      }
      
      // Apply search filter (case insensitive)
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          (post.title && post.title.toLowerCase().includes(query)) ||
          (post.description && post.description.toLowerCase().includes(query))
        );
      }
      
      return true;
    })
    .sort((a, b) => {
      // First sort pinned posts to the top
      const aIsPinned = a.is_pinned;
      const bIsPinned = b.is_pinned;
      
      if (aIsPinned && !bIsPinned) return -1;
      if (!aIsPinned && bIsPinned) return 1;
      
      // If both posts have the same pin status, sort by date (oldest at top, newest at bottom)
      // Then apply the selected sort option
      switch (sortOption) {
        case 'newest':
          return new Date(a.created_at) - new Date(b.created_at); // 反转：最新的在底部
        case 'oldest':
          return new Date(b.created_at) - new Date(a.created_at); // 反转：最旧的在顶部
        case 'alphabetical':
          return a.title.localeCompare(b.title);
        case 'popular':
          // Count total reactions
          const aReactions = Object.values(a.reactions || {}).flat().length;
          const bReactions = Object.values(b.reactions || {}).flat().length;
          return bReactions - aReactions;
        default:
          return new Date(a.created_at) - new Date(b.created_at); // 默认最新的在底部
      }
    });
  
  // 验证表单输入
  useEffect(() => {
    const titleValid = newPostTitle.trim().length >= 2 && newPostTitle.trim().length <= 50;
    setIsFormValid(titleValid);
  }, [newPostTitle, newPostDescription]);

  // 重置表单
  const resetForm = () => {
    setNewPostTitle('');
    setNewPostDescription('');
    setNewPostContent('');
    setPostType('post');
    setShowCreateDialog(false);
    setShowInlineEditor(false);
  };

  // Dialog关闭时重置表单
  useEffect(() => {
    if (!showCreateDialog && !showInlineEditor) {
      setNewPostTitle('');
      setNewPostDescription('');
      setNewPostContent('');
      setPostType('post');
    }
  }, [showCreateDialog, showInlineEditor]);

  // Handle post creation
  const handleCreatePost = async () => {
    const trimmedTitle = newPostTitle.trim();
    
    if (trimmedTitle.length < 2 || trimmedTitle.length > 50) {
      toast.error(t('titleLengthError'));
      return;
    }
    
    try {
      const result = await CreatePost({
        title: trimmedTitle,
        description: showInlineEditor ? newPostContent : newPostDescription,
        type: 'post',
        teamId
      });
      
      if (result) {
        // Add new post to the posts array at the end (to show at the bottom)
        setPosts(prev => [...prev, result]);
        // Reset form and close editor
        resetForm();
      }
    } catch (error) {
      console.error(t('createPostError'), error);
    }
  };
  
  // Handle reaction
  const handleReaction = async (postId, emoji = 'like') => {
    if (!user?.id) {
      toast.error(t('loginToReact'));
      return;
    }
    
    try {
      const result = await ReactToPost({ postId, emoji });
      
      if (result) {
        // Update posts array with new reactions
        setPosts(prev => 
          prev.map(post => 
            post.id === postId 
              ? { ...post, reactions: result.reactions } 
              : post
          )
        );
      }
    } catch (error) {
      console.error(t('addReactionError'), error);
    }
  };
  
  // Handle comment
  const handleAddComment = async (postId, content) => {
    if (!user?.id) {
      toast.error(t('loginToComment'));
      return;
    }
    
    if (!content.trim()) {
      toast.error(t('commentRequired'));
      return;
    }
    
    try {
      const result = await CommentOnPost({ postId, content });
      
      if (result) {
        // Update posts array with new comment
        setPosts(prev => 
          prev.map(post => 
            post.id === postId 
              ? { ...post, comments: result.comments } 
              : post
          )
        );
      }
    } catch (error) {
      console.error(t('addCommentError'), error);
    }
  };
  
  // Handle post delete
  const handleDeletePost = async (postId) => {
    confirm({
      title: t('confirmDeleteTitle'),
      description: t('confirmDeleteDescription'),
      variant: 'error',
      confirmText: t('delete'),
      cancelText: t('cancel'),
      onConfirm: async () => {
        try {
          const success = await DeletePost(postId);
          if (success) {
            // Remove from local state
            setPosts(prev => prev.filter(p => p.id !== postId));
            // Remove from pinned posts if it was pinned
            if (pinnedPosts.has(postId)) {
              setPinnedPosts(prev => {
                const newPinned = new Set(prev);
                newPinned.delete(postId);
                return newPinned;
              });
            }
          }
        } catch (error) {
          console.error(t('deletePostError'), error);
        }
      }
    });
  };
  
  // 切换帖子展开/收起状态
  const togglePostExpand = (postId) => {
    setExpandedPosts(prev => ({
      ...prev,
      [postId]: !prev[postId]
    }));
  };
  
  // 处理富文本内容显示
  const renderRichTextContent = (content) => {
    // 确保content是有效的字符串，防止渲染错误
    if (!content || typeof content !== 'string') {
      return <div className="rich-content w-full overflow-x-hidden break-all"></div>;
    }
    return (
      <div 
        className="rich-content w-full overflow-x-hidden break-all" 
        dangerouslySetInnerHTML={{ __html: content }} 
      />
    );
  };
  
  // Render loading skeleton
  const renderSkeleton = () => (
    <div className={`grid ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'} gap-4`}>
      {[1, 2, 3, 4, 5, 6].map((item) => (
        <Card key={item} className="flex flex-col h-full min-h-[260px] rounded-lg border transition-all bg-white border-[#E1DFDD] dark:bg-[#2D2C2C] dark:border-[#3B3A39] dark:text-white">
          <CardHeader className="pb-2">
            <div className="flex items-center space-x-2">
              <Skeleton className="h-10 w-10 rounded-full bg-[#F3F2F1] dark:bg-[#3B3A39]" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-24 bg-[#F3F2F1] dark:bg-[#3B3A39]" />
                <Skeleton className="h-3 w-16 bg-[#F3F2F1] dark:bg-[#3B3A39]" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="pb-2 flex-grow">
            <Skeleton className="h-4 w-full mb-2 bg-[#F3F2F1] dark:bg-[#3B3A39]" />
            <Skeleton className="h-4 w-5/6 mb-2 bg-[#F3F2F1] dark:bg-[#3B3A39]" />
            <Skeleton className="h-4 w-4/6 bg-[#F3F2F1] dark:bg-[#3B3A39]" />
          </CardContent>
          <CardFooter>
            <div className="flex justify-between items-center w-full">
              <div className="flex space-x-2">
                <Skeleton className="h-8 w-8 rounded-full bg-[#F3F2F1] dark:bg-[#3B3A39]" />
                <Skeleton className="h-8 w-8 rounded-full bg-[#F3F2F1] dark:bg-[#3B3A39]" />
              </div>
              <Skeleton className="h-4 w-16 bg-[#F3F2F1] dark:bg-[#3B3A39]" />
            </div>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
  
  // Render grid view of posts
  const renderGridView = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {filteredAndSortedPosts.map((post) => (
        <Card 
          key={post.id} 
          className={cn(
            "overflow-hidden transition-all hover:shadow-md relative border-[#E1DFDD] hover:bg-accent dark:border-[#3B3A39] dark:text-white flex flex-col h-full min-h-[260px]",
            post.is_pinned && "border-l-4"
          )}
          style={post.is_pinned ? { borderLeftColor: getColorHexCode(themeColor) } : {}}
        >
          <CardHeader className="pb-2 pt-4">
            <div className="flex justify-between items-start">
              <div className="flex items-center space-x-2">
                <Avatar className="border-2"> 
                  <AvatarImage src={userMap[post.created_by]?.avatar_url || "/placeholder-avatar.jpg"} />
                  <AvatarFallback style={{ backgroundColor: getColorHexCode(themeColor) }} className="text-white">
                    {post.created_by && userMap[post.created_by] ? userMap[post.created_by].name?.substring(0, 2).toUpperCase() : 'UN'}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center">
                    <CardTitle className="text-base font-semibold w-full truncate max-w-[200px] sm:max-w-[300px] md:max-w-[400px] lg:max-w-[600px] xl:max-w-[800px]">
                      {post.title || t('noTitle')}
                    </CardTitle>
                  </div>
                  <CardDescription className="text-xs text-[#605E5C] dark:text-[#C8C6C4]">
                    {new Date(post.created_at).toLocaleDateString()}
                  </CardDescription>
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 rounded-full hover:bg-[#F5F5F5] text-[#252423] dark:hover:bg-[#3B3A39] dark:text-white flex-shrink-0"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent 
                  align="end"
                >
                  <DropdownMenuItem 
                    className="hover:bg-accent"
                    onClick={() => togglePinPost(post.id)}
                  >
                    {post.is_pinned ? (
                      <>
                        <PinOff className="h-4 w-4 mr-2" />
                        {t('unpin')}
                      </>
                    ) : (
                      <>
                        <Pin className="h-4 w-4 mr-2" />
                        {t('pin')}
                      </>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    className="hover:bg-accent"
                  >
                    <Pen className="h-4 w-4 mr-2" />
                    {t('edit')}
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    className="hover:bg-accent"
                    onClick={() => handleDeletePost(post.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-2 text-red-500 hover:text-red-600" />
                    <span className="text-red-500 hover:text-red-600">{t('delete')}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardHeader>
          <CardContent className="pb-2 flex-grow">
            <div className={cn(
              "rich-text-container overflow-hidden relative w-full flex-grow",
              expandedPosts[post.id] 
                ? "max-h-full overflow-y-auto" 
                : "max-h-[80px]"
            )}>
              {post.description ? (
                <div className="prose prose-sm max-w-full dark:prose-invert break-words break-all overflow-x-hidden">
                  {renderRichTextContent(post.description)}
                </div>
              ) : (
                <p className="text-sm text-[#605E5C] dark:text-[#C8C6C4]">
                  {t('noDescription')}
                </p>
              )}
            </div>
            
            {post.description && typeof post.description === 'string' && post.description.length > 100 && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full mt-1 text-xs flex items-center justify-center"
                onClick={() => togglePostExpand(post.id)}
              >
                {expandedPosts[post.id] ? (
                  <>
                    <ChevronUp className="h-3 w-3 ml-1" />
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3 w-3 ml-1" />
                  </>
                )}
              </Button>
            )}
          </CardContent>
          <CardFooter className="pt-2 flex justify-between">
            <div className="flex space-x-2">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 rounded-full hover:bg-[#F5F5F5] dark:hover:bg-[#3B3A39]"
                onClick={() => handleReaction(post.id, 'like')}
              >
                <ThumbsUp className={cn(
                  "h-4 w-4 text-[#252423] dark:text-white", 
                  post.reactions?.like?.includes(user?.id) && "fill-current text-[#6264A7]"
                )} />
                {post.reactions?.like?.length > 0 && (
                  <span className={cn(
                    "ml-1 text-xs text-[#252423] dark:text-white", 
                    post.reactions?.like?.includes(user?.id) && "text-[#6264A7]"
                  )}>
                    {post.reactions.like.length}
                  </span>
                )}
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 rounded-full hover:bg-[#F5F5F5] dark:hover:bg-[#3B3A39]"
              >
                <MessageSquare className="h-4 w-4 text-[#252423] dark:text-white" />
                {post.comments?.length > 0 && (
                  <span className="ml-1 text-xs text-[#252423] dark:text-white">
                    {post.comments.length}
                  </span>
                )}
              </Button>
            </div>
            <div className="flex items-center text-xs text-[#605E5C] dark:text-[#C8C6C4]">
              <Clock className="h-3 w-3 mr-1" />
              {new Date(post.updated_at || post.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
  
  // Render list view of posts
  const renderListView = () => (
    <div className="flex flex-col space-y-2">
      {filteredAndSortedPosts.map((post) => (
        <Card 
          key={post.id} 
          className={cn(
            "overflow-hidden overflow-x-auto transition-all hover:shadow-md relative border-[#E1DFDD] hover:bg-accent dark:border-[#3B3A39] dark:text-white",
            post.is_pinned && "border-l-4"
          )}
          style={post.is_pinned ? { borderLeftColor: getColorHexCode(themeColor) } : {}}
        >
          <div className="flex flex-col md:flex-row p-0 h-full">
            <div className="flex-grow p-4 flex flex-col">
              <div className="flex justify-between items-start">
                <div className="flex items-center space-x-3">
                  <Avatar className="border-2">
                    <AvatarImage src={userMap[post.created_by]?.avatar_url || "/placeholder-avatar.jpg"} />
                    <AvatarFallback style={{ backgroundColor: getColorHexCode(themeColor) }} className="text-white">
                      {post.created_by && userMap[post.created_by] ? userMap[post.created_by].name?.substring(0, 2).toUpperCase() : 'UN'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center">
                      <h3 className="text-base font-semibold truncate max-w-[200px] sm:max-w-[250px] md:max-w-[350px] lg:max-w-[450px] xl:max-w-[550px]">
                        {post.title || t('noTitle')}
                      </h3>
                      {post.is_pinned && (
                        <Pin size={14} style={{ color: getColorHexCode(themeColor) }} className="ml-2 flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-[#605E5C] dark:text-[#C8C6C4]">
                      {new Date(post.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center">
                  <div className="flex items-center text-xs mr-4 text-[#605E5C] dark:text-[#C8C6C4]">
                    <Clock className="h-3 w-3 mr-1" />
                    {new Date(post.updated_at || post.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 rounded-full hover:bg-[#F5F5F5] text-[#252423] dark:hover:bg-[#3B3A39] dark:text-white flex-shrink-0"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent 
                      align="end"
                    >
                      <DropdownMenuItem 
                        className="hover:bg-accent"
                        onClick={() => togglePinPost(post.id)}
                      >
                        {post.is_pinned ? (
                          <>
                            <PinOff className="h-4 w-4 mr-2" />
                            {t('unpin')}
                          </>
                        ) : (
                          <>
                            <Pin className="h-4 w-4 mr-2" />
                            {t('pin')}
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="hover:bg-accent"
                      >
                        <Pen className="h-4 w-4 mr-2" />
                        {t('edit')}
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="hover:bg-accent"
                        onClick={() => handleDeletePost(post.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-2 text-red-500 hover:text-red-600" />
                        <span className="text-red-500 hover:text-red-600">{t('delete')}</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              
              <div className={cn(
                "rich-text-container overflow-hidden overflow-x-auto relative mt-2 w-full flex-grow",
                expandedPosts[post.id] 
                  ? "max-h-full overflow-y-auto" 
                  : "max-h-[80px]"
              )}>
                {post.description ? (
                  <div className="prose prose-sm max-w-full dark:prose-invert break-words break-all overflow-x-hidden">
                    {renderRichTextContent(post.description)}
                  </div>
                ) : (
                  <p className="text-sm text-[#605E5C] dark:text-[#C8C6C4]">
                    {t('noDescription')}
                  </p>
                )}
              </div>
              
              {post.description && typeof post.description === 'string' && post.description.length > 100 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full mt-1 text-xs flex items-center justify-center"
                  onClick={() => togglePostExpand(post.id)}
                >
                  {expandedPosts[post.id] ? (
                    <>
                      <ChevronUp className="h-3 w-3 ml-1" />
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-3 w-3 ml-1" />
                    </>
                  )}
                </Button>
              )}
              
              <div className="flex justify-start items-center mt-auto pt-3">
                <div className="flex space-x-3">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className={cn(
                      "h-8 px-2 rounded-md flex items-center hover:bg-[#F5F5F5] dark:hover:bg-[#3B3A39]",
                      post.reactions?.like?.includes(user?.id) && "text-[#6264A7]"
                    )}
                    onClick={() => handleReaction(post.id, 'like')}
                  >
                    <ThumbsUp className={cn(
                      "h-4 w-4 mr-1 text-[#252423] dark:text-white", 
                      post.reactions?.like?.includes(user?.id) && "fill-current text-[#6264A7]"
                    )} />
                    <span className={post.reactions?.like?.includes(user?.id) ? "text-[#6264A7]" : ""}>
                      {post.reactions?.like?.length || 0}
                    </span>
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="h-8 px-2 rounded-md flex items-center hover:bg-[#F5F5F5] dark:hover:bg-[#3B3A39]"
                  >
                    <MessageSquare className="h-4 w-4 mr-1 text-[#252423] dark:text-white" />
                    <span>{post.comments?.length || 0}</span>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
  
  // 添加滚动效果
  useEffect(() => {
    if (showInlineEditor && inlineEditorRef.current) {
      // 使用setTimeout确保DOM已更新
      setTimeout(() => {
        inlineEditorRef.current.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        });
      }, 100);
    }
  }, [showInlineEditor]);
  
  // Render inline post editor
  const renderInlineEditor = () => (
    <Card 
      ref={inlineEditorRef}
      className="mb-4 mt-2 overflow-hidden border bg-background border-[#E1DFDD] dark:border-[#3B3A39] dark:text-white"
    >
      <div className="p-4">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center space-x-3 flex-grow">
            <Avatar className="border-2">
              <AvatarImage src={user?.avatar_url || "/placeholder-avatar.jpg"} />
              <AvatarFallback style={{ backgroundColor: getColorHexCode(themeColor) }} className="text-white">
                {user?.name?.substring(0, 2).toUpperCase() || 'UN'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0 w-full max-w-full">
              <div className="grid gap-2">
                <div className="">
                  <div className="relative">
                    <Input
                      id="title"
                      autoFocus
                      placeholder={t('postTitlePlaceholder')}
                      value={newPostTitle}
                      onChange={(e) => setNewPostTitle(e.target.value)}
                      className="text-lg border-border border shadow-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-[#252423] dark:text-white w-full focus:border-gray-500 dark:focus:border-white pr-16"
                      maxLength={50}
                    />
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-[#605E5C] dark:text-[#C8C6C4]">
                      <span className="font-medium">
                        {newPostTitle.trim().length}/50
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2 ml-4">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 rounded-md hover:bg-[#F5F5F5] dark:hover:bg-[#3B3A39] flex items-center gap-1 text-[#252423] dark:text-white"
                >
                  <span>{t('postType')}</span>
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-0">
                <div className="py-1">
                  <Button
                    variant="ghost"
                    className="w-full justify-between gap-2 rounded-none"
                    onClick={() => setPostType('post')}
                  >
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      <span>{t('post')}</span>
                    </div>
                    {postType === 'post' && <Check className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-between gap-2 rounded-none"
                    onClick={() => setPostType('announcement')}
                  >
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 rotate-180" />
                      <span>{t('announcement')}</span>
                    </div>
                    {postType === 'announcement' && <Check className="h-4 w-4" />}
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
            
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full hover:bg-[#F5F5F5] dark:hover:bg-[#3B3A39]"
              onClick={resetForm}
            >
              <Trash2 className="h-4 w-4 text-red-500 hover:text-red-600" />
            </Button>
          </div>
        </div>
        
        <div className="border-t pt-4 border-[#E1DFDD] dark:border-[#3B3A39]">
          <div className="grid gap-4">
            <div className="relative mb-6">
              <RichEditor
                placeholder={t('postDescriptionPlaceholder')}
                value={newPostContent}
                onChange={setNewPostContent}
                className="h-[100px] min-h-[100px] max-h-[100px] overflow-hidden text-[#252423] dark:text-white border-[#E1DFDD] dark:border-[#3B3A39]"
              />
            </div>
          </div>
        </div>
        
        <div className="flex justify-between items-center pt-3 border-t border-[#E1DFDD] dark:border-[#3B3A39]">
          <div className="flex items-center space-x-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full hover:bg-[#F5F5F5] dark:hover:bg-[#3B3A39]"
                >
                  <Smile className="h-4 w-4 text-[#252423] dark:text-white" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-2">
                <div className="grid grid-cols-8 gap-2">
                  {['😊', '👍', '❤️', '😂', '🎉', '🙌', '👏', '🔥',
                    '💯', '⭐', '✅', '🚀', '💪', '👀', '🤔', '🙏'].map(emoji => (
                    <Button
                      key={emoji}
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full"
                      onClick={() => setNewPostContent(prev => prev + emoji)}
                    >
                      {emoji}
                    </Button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full hover:bg-[#F5F5F5] dark:hover:bg-[#3B3A39]"
            >
              <Paperclip className="h-4 w-4 text-[#252423] dark:text-white" />
            </Button>
          </div>
          
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowInlineEditor(false)}
              className="rounded-md border-[#E1DFDD] text-[#252423] hover:bg-[#F5F5F5] dark:border-[#3B3A39] dark:text-white dark:hover:bg-[#3B3A39]"
            >
              {t('cancel')}
            </Button>
            <Button
              variant={themeColor}
              size="sm"
              onClick={handleCreatePost}
              disabled={!isFormValid}
              className="rounded-md"
            >
              {t('post')}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
  
  return (
    <div className="container mx-auto pb-6 text-[#252423] dark:text-white">
      <style jsx global>{`
        .rich-content img {
          max-width: 100%;
          height: auto;
        }
        .rich-content pre {
          white-space: pre-wrap;
          overflow-x: auto;
          max-width: 100%;
        }
        .rich-content * {
          max-width: 100%;
          overflow-wrap: break-word;
          word-wrap: break-word;
          word-break: break-word;
        }
        .rich-text-container {
          width: 100%;
          max-width: 100%;
          overflow-x: hidden;
          height: auto;
        }
        .prose {
          max-width: 100%;
          overflow-wrap: break-word;
          word-break: break-word;
        }
        .rich-editor-container {
          display: flex;
          flex-direction: column;
          height: auto;
        }
      `}</style>
      
      {/* Header */}
      <div className="sticky top-0 z-10 px-4 py-3 mb-4 shadow-sm border-b bg-background border-[#E1DFDD] dark:border-[#3B3A39]">
        <div className="flex flex-col md:flex-row justify-between bg-background items-start md:items-center gap-4">
          <div className="flex flex-col sm:flex-row gap-3 w-full bg-background">
            {viewMode === 'grid' ? (
              <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogTrigger asChild>
                  <Button 
                    variant={themeColor}
                    size="icon"
                    className="rounded-md transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent 
                  onPointerDownOutside={(e) => e.preventDefault()}
                  onEscapeKeyDown={(e) => e.preventDefault()}
                  className="sm:max-w-[650px]"
                >
                  <DialogHeader>
                    <div className="flex justify-between items-center"> 
                      <DialogTitle>{t('createNewPost')}</DialogTitle>
                      <div className="flex items-center space-x-2">
                        {/* <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-full hover:bg-[#F5F5F5] dark:hover:bg-[#3B3A39]"
                          onClick={resetForm}
                        >
                          <Trash2 className="h-4 w-4 text-[#252423] dark:text-white" />
                        </Button> */}
                      </div> 
                    </div>
                    <DialogDescription className="text-[#605E5C] dark:text-[#C8C6C4]">
                      {t('createPostDescription')}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="title" className="font-medium">{t('title')}</Label>
                      <div className="mb-3">
                        <div className="relative">
                          <Input
                            id="title"
                            placeholder={t('postTitlePlaceholder')}
                            value={newPostTitle}
                            onChange={(e) => setNewPostTitle(e.target.value)}
                            className="border border-[#E1DFDD] text-[#252423] dark:border-[#3B3A39] dark:text-white w-full pr-16"
                            maxLength={50}
                          />
                          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-[#605E5C] dark:text-[#C8C6C4] bg-background px-1">
                            <span className="font-medium">
                              {newPostTitle.trim().length}/50
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="description" className="font-medium">{t('description')}</Label>
                      <div className="mb-3">
                        <RichEditor
                          id="description"
                          placeholder={t('postDescriptionPlaceholder')}
                          value={newPostDescription}
                          onChange={setNewPostDescription}
                          className="h-[135px] min-h-[135px] max-h-[250px] overflow-y-auto border border-[#E1DFDD] text-[#252423] dark:border-[#3B3A39] dark:text-white"
                        />
                        <div className="mt-2 flex justify-between items-center">
                          <div className="flex items-center space-x-2">
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 rounded-full hover:bg-[#F5F5F5] dark:hover:bg-[#3B3A39]"
                                >
                                  <Smile className="h-4 w-4 text-[#252423] dark:text-white" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-80 p-2">
                                <div className="grid grid-cols-8 gap-2">
                                  {['😊', '👍', '❤️', '😂', '🎉', '🙌', '👏', '🔥',
                                    '💯', '⭐', '✅', '🚀', '💪', '👀', '🤔', '🙏'].map(emoji => (
                                    <Button
                                      key={emoji}
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 rounded-full"
                                      onClick={() => setNewPostDescription(prev => prev + emoji)}
                                    >
                                      {emoji}
                                    </Button>
                                  ))}
                                </div>
                              </PopoverContent>
                            </Popover>
                            
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-full hover:bg-[#F5F5F5] dark:hover:bg-[#3B3A39]"
                            >
                              <Paperclip className="h-4 w-4 text-[#252423] dark:text-white" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <DialogFooter className="flex w-full justify-between items-center">                    
                    <div className="mr-auto">                      
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 rounded-md border-[#E1DFDD] hover:bg-[#F5F5F5] dark:border-[#3B3A39] dark:hover:bg-[#3B3A39] flex items-center gap-1 text-[#252423] dark:text-white"
                          >
                            <div className="flex items-center gap-1">
                              {postType === 'post' ? (
                                <MessageSquare className="h-4 w-4" />
                              ) : (
                                <MessageSquare className="h-4 w-4 rotate-180" />
                              )}
                              <span>{postType === 'post' ? t('post') : t('announcement')}</span>
                            </div>
                            <ChevronDown className="h-3 w-3 ml-1" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-48 p-0">
                          <div className="py-1">
                            <Button
                              variant="ghost"
                              className="w-full justify-start gap-2 rounded-none"
                              onClick={() => setPostType('post')}
                            >
                              <div className="flex items-center gap-2">
                                <MessageSquare className="h-4 w-4" />
                                <span>{t('post')}</span>
                              </div>
                              {postType === 'post' && <Check className="h-4 w-4 ml-auto" />}
                            </Button>
                            <Button
                              variant="ghost"
                              className="w-full justify-start gap-2 rounded-none"
                              onClick={() => setPostType('announcement')}
                            >
                              <div className="flex items-center gap-2">
                                <MessageSquare className="h-4 w-4 rotate-180" />
                                <span>{t('announcement')}</span>
                              </div>
                              {postType === 'announcement' && <Check className="h-4 w-4 ml-auto" />}
                            </Button>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="flex space-x-2">
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => setShowCreateDialog(false)}
                        className="border-[#E1DFDD] dark:border-[#3B3A39]"
                      >
                        {t('cancel')}
                      </Button>
                      <Button 
                        variant={themeColor}
                        type="submit" 
                        onClick={handleCreatePost}
                        disabled={!isFormValid}
                        className="min-w-[80px]"
                      >
                        {t('post')}
                      </Button>
                    </div>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            ) : (
              <Button 
                variant={themeColor}
                size="icon"
                className="rounded-md transition-colors"
                onClick={() => setShowInlineEditor(true)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            )}
            <div className="relative flex-grow">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#8A8886] dark:text-[#979593]" />
              <Input
                placeholder={t('searchPosts')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 rounded-md border bg-background border-[#E1DFDD] text-[#252423] placeholder:text-[#8A8886] focus-visible:ring-offset-white dark:border-[#3B3A39] dark:text-white dark:placeholder:text-[#979593]"
              />
            </div>
            <div className="flex items-center gap-2 sm:ml-auto">
              <Button
                variant={viewMode === 'list' ? themeColor : "outline"}
                size="icon"
                onClick={() => setViewMode('list')}
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'grid' ? themeColor : "outline"}
                size="icon"
                onClick={() => setViewMode('grid')}
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Content */}
      <div className="px-4">
        {isLoading ? (
          renderSkeleton()
        ) : (
          <div className="mt-4">            
            {posts.length === 0 && !showInlineEditor ? (
              <div className="text-center py-12 border rounded-md bg-background border-[#E1DFDD] text-[#252423] dark:border-[#3B3A39] dark:text-white">
                <div className="mx-auto flex flex-col items-center">
                  <MessageSquare className="h-12 w-12 mb-4 text-[#8A8886] dark:text-[#979593]" />
                  <h3 className="text-lg font-medium mb-1">{t('noPosts')}</h3>
                  <p className="text-sm max-w-sm mb-4 text-[#605E5C] dark:text-[#C8C6C4]">
                    {t('noPostsDescription')}
                  </p>
                  <Button 
                    onClick={() => viewMode === 'list' ? setShowInlineEditor(true) : setShowCreateDialog(true)}
                    variant={themeColor}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    {t('createFirstPost')}
                  </Button>
                </div>
              </div>
            ) : (
              viewMode === 'grid' ? renderGridView() : renderListView()
            )}
            {viewMode === 'list' && showInlineEditor && renderInlineEditor()}

          </div>
        )}
      </div>
    </div>
  );
}