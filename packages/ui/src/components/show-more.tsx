import { useState } from "react";

import { Button } from "./button";

// Caps a long list (fills, snapshots) and offers the rest on demand.
function useShowMore<T>(items: readonly T[], limit = 20) {
    const [all, setAll] = useState(false);
    const visible = all ? items : items.slice(0, limit);
    return {
        visible,
        footer:
            items.length > limit ? (
                <div className="flex items-center justify-between gap-3 pt-2 text-sm text-muted-foreground">
                    <span>
                        Showing {visible.length} of {items.length}
                    </span>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setAll((a) => !a)}
                    >
                        {all ? "Show less" : "Show all"}
                    </Button>
                </div>
            ) : null,
    };
}

export { useShowMore };
