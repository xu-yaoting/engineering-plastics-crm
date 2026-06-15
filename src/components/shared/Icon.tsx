import {
  Search, Mail, Pencil, Plus, Copy, Trash2, Package, FileText,
  Phone, Star, ArrowLeft, ArrowRight, MoreVertical, Circle,
  Building2, CheckCircle, AlertTriangle, XCircle, RefreshCw,
  FlaskConical,
  Users, Calendar, Truck, Plane, Factory, Save, Download,
  Link, BarChart, TrendingUp, DollarSign, Target, Flame,
  ChevronDown, ChevronRight, X, Menu, Home, Bell,
  ExternalLink, Eye, EyeOff, Filter, Clock, Upload,
  SquarePen, FileDown, CreditCard, Bot, Lightbulb,
  FileEdit, ShoppingCart, Globe, Info, Settings, type LucideIcon,
} from 'lucide-react';

export type IconName =
  | 'search' | 'mail' | 'edit' | 'plus' | 'copy' | 'delete'
  | 'package' | 'pdf' | 'phone' | 'star' | 'back' | 'forward'
  | 'more' | 'circle' | 'building' | 'check' | 'warning' | 'x'
  | 'refresh' | 'users' | 'calendar' | 'truck' | 'plane' | 'factory'
  | 'save' | 'download' | 'link' | 'chart' | 'trending' | 'dollar'
  | 'target' | 'flame' | 'chevron-down' | 'chevron-right' | 'close'
  | 'menu' | 'home' | 'bell' | 'external' | 'eye' | 'eye-off' | 'filter'
  | 'clock' | 'upload' | 'square-pen' | 'file-down' | 'credit-card'
  | 'bot' | 'lightbulb' | 'file-edit' | 'cart' | 'globe' | 'info' | 'settings'
  | 'flask-conical';

const ICONS: Record<string, LucideIcon> = {
  search: Search,
  mail: Mail,
  edit: Pencil,
  'square-pen': SquarePen,
  plus: Plus,
  copy: Copy,
  delete: Trash2,
  package: Package,
  pdf: FileText,
  'file-down': FileDown,
  phone: Phone,
  star: Star,
  back: ArrowLeft,
  forward: ArrowRight,
  more: MoreVertical,
  circle: Circle,
  building: Building2,
  check: CheckCircle,
  warning: AlertTriangle,
  x: XCircle,
  refresh: RefreshCw,
  users: Users,
  calendar: Calendar,
  truck: Truck,
  plane: Plane,
  factory: Factory,
  save: Save,
  download: Download,
  link: Link,
  chart: BarChart,
  trending: TrendingUp,
  dollar: DollarSign,
  'credit-card': CreditCard,
  target: Target,
  flame: Flame,
  'chevron-down': ChevronDown,
  'chevron-right': ChevronRight,
  close: X,
  menu: Menu,
  home: Home,
  bell: Bell,
  external: ExternalLink,
  eye: Eye,
  'eye-off': EyeOff,
  filter: Filter,
  clock: Clock,
  upload: Upload,
  bot: Bot,
  lightbulb: Lightbulb,
  globe: Globe,
  info: Info,
  settings: Settings,
  'file-edit': FileEdit,
  cart: ShoppingCart,
  'flask-conical': FlaskConical,
};

const SIZE_MAP: Record<string, number> = {
  sidebar: 18,
  toolbar: 16,
  inline: 14,
};

export default function Icon({
  name,
  size = 14,
  className = '',
}: {
  name: IconName;
  size?: number | 'sidebar' | 'toolbar' | 'inline';
  className?: string;
}) {
  const resolvedSize = typeof size === 'string' ? (SIZE_MAP[size] || 14) : size;
  const LucideIcon = ICONS[name];
  if (!LucideIcon) return <span className={className}>[?]</span>;
  return <LucideIcon size={resolvedSize} className={className} />;
}
