"use client"

import { useState, useRef, useEffect } from "react"
import {
  Plus, MapPin, ImageIcon, Mic, MoreVertical, X,
  Check, CheckCheck, FileText,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"

// ─── Types ────────────────────────────────────────────────────────────────────

type Message = {
  id: string
  content: string
  sender: "me" | "them"
  time: string
  type: "text" | "file" | "post"
  status?: "sent" | "read"
  file?: { name: string; size: string }
  post?: { image: string; title: string; price: string }
}

type Conversation = {
  id: string
  name: string
  avatar: string
  lastMessage: string
  time: string
  lastActive: string
  messages: Message[]
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const CONVERSATIONS: Conversation[] = [
  {
    id: "1",
    name: "TSD",
    avatar: "",
    lastMessage: "this is my CV bong ✓",
    time: "07, Oct 2025",
    lastActive: "Last Active 24-Apr-2026",
    messages: [
      {
        id: "m1", sender: "me", type: "post", time: "07, Oct 2025", status: "read",
        content: "",
        post: { image: "", title: "គ្រូបង្រៀន អភិវឌ្ឍន៍...", price: "$ 100" },
      },
      { id: "m2", sender: "me", type: "text", content: "ជំរាបសួរ 🙏", time: "07, Oct 2025", status: "read" },
      { id: "m3", sender: "me", type: "text", content: "អ្នកចង់អាក្រក់ណាស់ បុគ្គលិកបាន់ ថ្ងៃអភិវឌ្ឍន៍ 🙂", time: "07, Oct 2025", status: "read" },
      { id: "m4", sender: "me", type: "text", content: "សូសួរ នៅមូនខាងចាកំពពារ ហាមដណាមជ័យបំ 🙏", time: "07, Oct 2025", status: "read" },
      { id: "m5", sender: "them", type: "text", content: "Yes you may apply", time: "07, Oct 2025" },
      {
        id: "m6", sender: "me", type: "file", content: "", time: "07, Oct 2025", status: "read",
        file: { name: "file_108289117598177743263873349.pdf", size: "497.04 KB" },
      },
      { id: "m7", sender: "me", type: "text", content: "this is my CV bong", time: "07, Oct 2025", status: "read" },
    ],
  },
]

const QUICK_REPLIES = [
  "Hi!",
  "Yes, it's still for sale",
  "What's you offer?",
  "Sorry! the product has been sold!",
  "Yes, it's negotiable",
  "No, it's not negotiable",
]

// ─── Skeleton Loading ─────────────────────────────────────────────────────────

function ChatSkeleton() {
  return (
    <div className="flex flex-col gap-6 p-6">
      {[1, 2, 3].map((i) => (
        <div key={i} className={cn("flex items-end gap-3", i % 2 === 0 && "flex-row-reverse")}>
          {i % 2 !== 0 && <Skeleton className="h-9 w-9 rounded-full shrink-0" />}
          <Skeleton
            className={cn(
              "h-12 rounded-2xl",
              i % 2 !== 0 ? "w-48 bg-sky-200" : "w-36 bg-muted",
              i === 1 && "w-64",
            )}
          />
        </div>
      ))}
      <div className="flex flex-row-reverse">
        <Skeleton className="h-10 w-24 rounded-2xl bg-muted" />
      </div>
    </div>
  )
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: Message }) {
  const isMe = msg.sender === "me"

  return (
    <div className={cn("flex items-end gap-2 group", isMe ? "flex-row-reverse" : "flex-row")}>
      {!isMe && (
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarImage src="" />
          <AvatarFallback className="text-xs bg-muted">T</AvatarFallback>
        </Avatar>
      )}

      <div className={cn("flex flex-col gap-0.5 max-w-[65%]", isMe ? "items-end" : "items-start")}>
        {/* Post card */}
        {msg.type === "post" && msg.post && (
          <div className="rounded-xl overflow-hidden border bg-card shadow-sm w-56">
            <div className="h-28 bg-muted flex items-center justify-center">
              <ImageIcon className="text-muted-foreground" size={32} />
            </div>
            <div className="p-2.5">
              <p className="text-xs font-medium line-clamp-2">{msg.post.title}</p>
              <p className="text-sm font-bold text-red-500 mt-1">{msg.post.price}</p>
            </div>
          </div>
        )}

        {/* File */}
        {msg.type === "file" && msg.file && (
          <div className={cn(
            "flex items-center gap-2 px-3 py-2.5 rounded-2xl",
            isMe ? "bg-muted" : "bg-sky-500 text-white"
          )}>
            <div className="bg-red-500 rounded p-1">
              <FileText size={14} className="text-white" />
            </div>
            <div>
              <p className="text-xs font-medium truncate max-w-[160px]">{msg.file.name}</p>
              <p className="text-[10px] opacity-70">{msg.file.size}</p>
            </div>
          </div>
        )}

        {/* Text */}
        {msg.type === "text" && (
          <div className={cn(
            "px-3.5 py-2 rounded-2xl text-sm leading-snug",
            isMe
              ? "bg-muted text-foreground rounded-br-sm"
              : "bg-sky-500 text-white rounded-bl-sm"
          )}>
            {msg.content}
          </div>
        )}

        {/* Time + status */}
        <div className={cn("flex items-center gap-1 px-1", isMe ? "flex-row-reverse" : "flex-row")}>
          <span className="text-[10px] text-muted-foreground">{msg.time}</span>
          {isMe && (
            msg.status === "read"
              ? <CheckCheck size={12} className="text-sky-500" />
              : <Check size={12} className="text-muted-foreground" />
          )}
        </div>
      </div>

      {/* ⋮ on hover */}
      <button className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full hover:bg-muted">
        <MoreVertical size={14} className="text-muted-foreground" />
      </button>
    </div>
  )
}

// ─── Main Chat Page ───────────────────────────────────────────────────────────

export default function ChatsPage() {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [input, setInput] = useState("")
  const [showQuickReplies, setShowQuickReplies] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const activeConvo = CONVERSATIONS.find((c) => c.id === activeId)

  const handleSelectConvo = (id: string) => {
    setLoading(true)
    setActiveId(id)
    setTimeout(() => setLoading(false), 800) // simulate load
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [activeId, loading])

  return (
    <div className="flex h-[calc(100vh-56px)]  bg-background border-t border-border overflow-hidden">

      {/* ── LEFT SIDEBAR ── */}
      <div className="w-[280px] shrink-0 border-r border-border flex flex-col bg-card">

        {/* Sidebar header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Avatar className="h-8 w-8">
              <AvatarImage src="" />
              <AvatarFallback className="text-xs">U</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-semibold leading-none">Thouch Sayi</p>
              <button className="text-[11px] text-muted-foreground hover:underline">Switch Profile</button>
            </div>
          </div>

          {/* Left ⋮ menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-1 rounded-full hover:bg-muted outline-none">
                <MoreVertical size={16} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {["All", "Buy", "Sell", "Unread", "Block User", "Mark all messages as read"].map((item) => (
                <DropdownMenuItem key={item}>{item}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {CONVERSATIONS.map((convo) => (
            <button
              key={convo.id}
              onClick={() => handleSelectConvo(convo.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left border-b border-border/50",
                activeId === convo.id && "bg-muted"
              )}
            >
              <Avatar className="h-10 w-10 shrink-0">
                <AvatarImage src={convo.avatar} />
                <AvatarFallback className="font-semibold">{convo.name[0]}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold truncate">{convo.name}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0 ml-1">{convo.time}</span>
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">{convo.lastMessage}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── RIGHT: CHAT AREA ── */}
      {!activeConvo ? (
        // Empty state
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
          Select a conversation to start chatting
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-w-0">

          {/* Chat header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card shrink-0">
            <div className="flex items-center gap-3">
              <Avatar className="h-9 w-9">
                <AvatarImage src={activeConvo.avatar} />
                <AvatarFallback className="font-semibold">{activeConvo.name[0]}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-semibold leading-none">{activeConvo.name}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{activeConvo.lastActive}</p>
              </div>
            </div>

            {/* Right ⋮ menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-1 rounded-full hover:bg-muted outline-none">
                  <MoreVertical size={16} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem>Contact Seller</DropdownMenuItem>
                <DropdownMenuItem>Hide Chat Template</DropdownMenuItem>
                <DropdownMenuItem>Block</DropdownMenuItem>
                <DropdownMenuItem className="text-destructive focus:text-destructive">Delete</DropdownMenuItem>
                <DropdownMenuItem className="text-destructive focus:text-destructive">
                  Report {activeConvo.name}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4 bg-background">
            {loading ? (
              <ChatSkeleton />
            ) : (
              <>
                {activeConvo.messages.map((msg) => (
                  <MessageBubble key={msg.id} msg={msg} />
                ))}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Quick reply chips */}
          {showQuickReplies && (
            <div className="flex items-center gap-2 px-4 py-2 overflow-x-auto shrink-0 border-t border-border/50 bg-card scrollbar-none">
              {QUICK_REPLIES.map((reply) => (
                <button
                  key={reply}
                  onClick={() => setInput(reply)}
                  className="shrink-0 text-xs bg-sky-500 hover:bg-sky-600 text-white px-3 py-1.5 rounded-full transition-colors whitespace-nowrap"
                >
                  {reply}
                </button>
              ))}
              <button
                onClick={() => setShowQuickReplies(false)}
                className="shrink-0 p-1 rounded-full hover:bg-muted transition-colors"
              >
                <X size={14} className="text-muted-foreground" />
              </button>
            </div>
          )}

          {/* Input bar */}
          <div className="flex items-center gap-2 px-3 py-2.5 border-t border-border bg-card shrink-0">
            <button className="p-2 rounded-full hover:bg-muted transition-colors text-sky-500 shrink-0">
              <Plus size={20} />
            </button>
            <button className="p-2 rounded-full hover:bg-muted transition-colors text-muted-foreground shrink-0">
              <MapPin size={18} />
            </button>
            <button className="p-2 rounded-full hover:bg-muted transition-colors text-muted-foreground shrink-0">
              <ImageIcon size={18} />
            </button>

            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message here..."
              className="flex-1 h-9 rounded-full bg-muted border-none text-sm px-4 focus-visible:ring-0"
              onKeyDown={(e) => {
                if (e.key === "Enter" && input.trim()) setInput("")
              }}
            />

            <button className="p-2 rounded-full hover:bg-muted transition-colors text-sky-500 shrink-0">
              <Mic size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}