import {
  Archive,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BookOpen,
  Building2,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleHelp,
  CircleX,
  ClipboardCheck,
  Clock3,
  Copy,
  Download,
  Eye,
  ExternalLink,
  FileArchive,
  FileText,
  FolderInput,
  FolderOpen,
  Gauge,
  GraduationCap,
  Image,
  Inbox,
  KeyRound,
  LayoutTemplate,
  Link2,
  LogOut,
  ListChecks,
  ListFilter,
  ListTodo,
  Maximize2,
  Minimize2,
  Mic,
  MoreHorizontal,
  PanelsTopLeft,
  Pencil,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Trash2,
  TriangleAlert,
  Upload,
  UserRound,
  UserRoundCog,
  UsersRound,
  Video,
  Volume2,
  WalletCards,
  X,
  ZoomIn,
  ZoomOut
} from 'lucide-vue-next'

const navigationIcons = {
  brand: ClipboardCheck,
  'after-class': ClipboardCheck,
  'basic-info': UsersRound,
  materials: FolderOpen,
  courseware: FolderOpen,
  operations: Settings2,
  schedule: CalendarDays,
  'today-tasks': ListChecks,
  supervision: Gauge,
  production: LayoutTemplate,
  teacher: UserRound,
  student: GraduationCap,
  class: UsersRound,
  'external-link': ExternalLink,
  course: BookOpen,
  archive: Archive,
  'extra-task': ListTodo,
  imports: Upload,
  campus: Building2,
  template: PanelsTopLeft,
  account: UserRoundCog,
  role: ShieldCheck,
  permission: KeyRound,
  settings: Settings2,
  todo: Inbox,
  finance: WalletCards,
  'task-system': ListTodo,
  academic: CalendarRange
}

const actionIcons = {
  add: Plus,
  search: Search,
  reset: RotateCcw,
  back: ArrowLeft,
  next: ArrowRight,
  upload: Upload,
  download: Download,
  edit: Pencil,
  copy: Copy,
  send: Send,
  retry: RefreshCw,
  delete: Trash2,
  close: X,
  filter: ListFilter,
  view: Eye,
  save: Save,
  play: Play,
  more: MoreHorizontal,
  link: Link2,
  logout: LogOut,
  calendar: CalendarDays,
  password: KeyRound,
  voice: Mic,
  pause: Pause,
  volume: Volume2,
  'move-up': ArrowUp,
  'move-down': ArrowDown,
  move: FolderInput,
  expand: ChevronDown,
  collapse: ChevronUp,
  'zoom-in': ZoomIn,
  'zoom-out': ZoomOut,
  fullscreen: Maximize2,
  'fullscreen-exit': Minimize2
}

const statusIcons = {
  check: CheckCircle2,
  warning: TriangleAlert,
  error: CircleX,
  pending: Clock3,
  image: Image,
  video: Video,
  file: FileText,
  'file-archive': FileArchive
}

export const iconRegistry = Object.freeze({
  ...navigationIcons,
  ...actionIcons,
  ...statusIcons
})

export const iconCategories = Object.freeze({
  navigation: Object.freeze(Object.keys(navigationIcons)),
  actions: Object.freeze(Object.keys(actionIcons)),
  status: Object.freeze(Object.keys(statusIcons))
})

export const iconNames = Object.freeze(Object.keys(iconRegistry))

const missingIconNames = new Set()

const displayNameFor = (name) => {
  const value = String(name ?? '').trim()
  return value || '<empty>'
}

export const resolveIcon = (name) => {
  const key = String(name ?? '').trim()
  const icon = iconRegistry[key]
  if (icon) return icon

  if (import.meta.env?.DEV && !missingIconNames.has(key)) {
    missingIconNames.add(key)
    console.warn(`[AppIcon] 未注册的图标名称：${displayNameFor(name)}`)
  }

  return CircleHelp
}
