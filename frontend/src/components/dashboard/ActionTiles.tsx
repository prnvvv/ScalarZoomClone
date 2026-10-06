import Link from "next/link";
import {
  CalendarIcon,
  PlusIcon,
  ScreenShareIcon,
  VideoIcon,
} from "@/components/icons";

const TILES = [
  {
    href: "/new-meeting",
    label: "New Meeting",
    hint: "Start an instant meeting",
    icon: VideoIcon,
    modifier: "",
  },
  {
    href: "/join",
    label: "Join Meeting",
    hint: "Enter a meeting ID",
    icon: PlusIcon,
    modifier: "action-tile--join",
  },
  {
    href: "/schedule",
    label: "Schedule Meeting",
    hint: "Plan it for later",
    icon: CalendarIcon,
    modifier: "action-tile--schedule",
  },
  {
    href: "/new-meeting?share=1",
    label: "Share Screen",
    hint: "Start with your screen",
    icon: ScreenShareIcon,
    modifier: "action-tile--share",
  },
];

export function ActionTiles() {
  return (
    <div className="action-tiles">
      {TILES.map((tile) => (
        <Link key={tile.label} href={tile.href} className={`action-tile ${tile.modifier}`}>
          <span className="action-tile__icon">
            <tile.icon size={22} />
          </span>
          <span>
            <span className="action-tile__label">{tile.label}</span>
            <span className="action-tile__hint">{tile.hint}</span>
          </span>
        </Link>
      ))}
    </div>
  );
}
