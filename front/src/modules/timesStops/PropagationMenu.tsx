import AnchoredMenu from 'common/AnchoredMenu';
import type { OSRDMenuItem } from 'common/OSRDMenu';
import OSRDMenu from 'common/OSRDMenu';

type PropagationMenuProps = {
  isOpen: boolean;
  anchorRef: React.RefObject<HTMLElement | null>;
  items: OSRDMenuItem[];
  /** Extra class on the wrapper, used to position the menu (item count differs per caller). */
  wrapperClassName?: string;
};

const PropagationMenu = ({ isOpen, anchorRef, items, wrapperClassName }: PropagationMenuProps) => (
  <AnchoredMenu
    anchorRef={anchorRef}
    onDismiss={() => {}}
    placement="beside"
    focusOnFirstElement={false}
  >
    {isOpen && (
      <div
        role="presentation"
        className={`propagation-menu-wrapper ${wrapperClassName ?? ''}`}
        data-testid="propagation-menu-wrapper"
        onMouseDown={(e) => e.preventDefault()}
      >
        <OSRDMenu items={items} className="propagation-menu" />
      </div>
    )}
  </AnchoredMenu>
);

export default PropagationMenu;
