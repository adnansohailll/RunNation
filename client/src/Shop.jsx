import { IconShop } from "./icons.jsx";
import EmptyStatePage from "./EmptyStatePage.jsx";

export default function Shop() {
  return (
    <EmptyStatePage
      title="Shop"
      message="Our shop is coming soon — gear up here once it launches."
      icon={<IconShop />}
    />
  );
}
