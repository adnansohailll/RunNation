import { IconClock } from "./icons.jsx";
import EmptyStatePage from "./EmptyStatePage.jsx";

export default function Events() {
  return (
    <EmptyStatePage
      title="Events"
      message="Nothing on the calendar yet — check back soon for what's coming up."
      icon={<IconClock />}
    />
  );
}
