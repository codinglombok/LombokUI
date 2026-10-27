<?php

declare(strict_types=1);

namespace Lombok\UI;

// The thirteen component state machines (SPEC 5). Each is pure: send() never mutates its input state.

final class DisclosureComponent extends Component
{
    public string $name = 'disclosure';

    protected function events(): array
    {
        return ['toggle' => [], 'open' => [], 'close' => []];
    }

    public function setup(mixed $options): array
    {
        $r = new Reader($options, 'invalid_option', 'options', ['idBase', 'defaultOpen', 'disabled']);
        return [(object) ['base' => $r->idBase(), 'disabled' => $r->bool('disabled', false)], ['open' => $r->bool('defaultOpen', false)]];
    }

    public function send(object $ctx, array $state, mixed $event): array
    {
        $e = $this->readEvent($event);
        if ($ctx->disabled) {
            return [$state, []];
        }
        $open = $e['type'] === 'toggle' ? !$state['open'] : $e['type'] === 'open';
        if ($open === $state['open']) {
            return [$state, []];
        }
        return [['open' => $open], [self::change('open', $open)]];
    }

    public function attrs(object $ctx, array $state): array
    {
        $b = $ctx->base;
        $trigger = ['id' => "$b-trigger", 'aria-expanded' => Util::boolAttr($state['open']), 'aria-controls' => "$b-panel"];
        if ($ctx->disabled) {
            $trigger['aria-disabled'] = 'true';
        }
        $trigger['data-state'] = self::stateAttr($state['open']);
        $panel = ['id' => "$b-panel", 'data-state' => self::stateAttr($state['open'])];
        if (!$state['open']) {
            $panel['hidden'] = true;
        }
        return ['trigger' => $trigger, 'panel' => $panel];
    }
}

final class AccordionComponent extends Component
{
    public string $name = 'accordion';

    protected function events(): array
    {
        return ['toggle' => ['req' => ['id' => 'id']], 'focus' => ['req' => ['id' => 'id']], 'blur' => [], 'keydown' => self::KEYDOWN];
    }

    public function setup(mixed $options): array
    {
        $r = new Reader($options, 'invalid_option', 'options', ['idBase', 'items', 'multiple', 'collapsible', 'defaultExpanded', 'orientation', 'dir', 'loop']);
        $items = Item::readList($r->raw('items'), 'invalid_option');
        $ctx = (object) [
            'base' => $r->idBase(),
            'items' => $items,
            'multiple' => $r->bool('multiple', false),
            'collapsible' => $r->bool('collapsible', true),
            'orientation' => $r->oneOf('orientation', ['vertical', 'horizontal'], 'vertical'),
            'dir' => $r->oneOf('dir', ['ltr', 'rtl'], 'ltr'),
            'loop' => $r->bool('loop', true),
        ];
        $expanded = self::readIdList($r, 'defaultExpanded', $items);
        if (!$ctx->multiple && count($expanded) > 1) {
            $r->bad('defaultExpanded', 'may hold at most one id unless multiple is true');
        }
        return [$ctx, ['expanded' => $expanded, 'focused' => null]];
    }

    /**
     * @param array<string, mixed> $state
     * @return array{0: array<string, mixed>, 1: bool}
     */
    private function toggle(object $ctx, array $state, mixed $id): array
    {
        $it = self::item($ctx->items, $id, 'toggle');
        if ($it->disabled) {
            return [$state, false];
        }
        $set = array_fill_keys($state['expanded'], true);
        if (isset($set[$it->id])) {
            if (!$ctx->collapsible && count($set) === 1) {
                return [$state, false];
            }
            unset($set[$it->id]);
        } else {
            if (!$ctx->multiple) {
                $set = [];
            }
            $set[$it->id] = true;
        }
        return [['expanded' => Util::ordered($ctx->items, $set), 'focused' => $state['focused']], true];
    }

    public function send(object $ctx, array $state, mixed $event): array
    {
        $e = $this->readEvent($event);
        $effects = [];
        $next = $state;
        $changed = false;
        $t = $e['type'];
        if ($t === 'toggle') {
            [$next, $changed] = $this->toggle($ctx, $state, $e['id']);
        } elseif ($t === 'focus') {
            if (Util::indexOf($ctx->items, $e['id']) < 0) {
                Util::fail('invalid_event', "focus: unknown item \"{$e['id']}\"");
            }
            $next = ['expanded' => $state['expanded'], 'focused' => $e['id']];
        } elseif ($t === 'blur') {
            $next = ['expanded' => $state['expanded'], 'focused' => null];
        } elseif ($state['focused'] !== null && !self::hasModifier($e)) {
            $key = $e['key'];
            if ($key === 'Enter' || $key === ' ') {
                [$next, $changed] = $this->toggle($ctx, $state, $state['focused']);
            } else {
                $move = Util::keyMove($key, $ctx->orientation, $ctx->dir);
                if ($move !== null) {
                    $to = Util::navigate($ctx->items, $state['focused'], $move, $ctx->loop);
                    if ($to !== null && $to !== $state['focused']) {
                        $next = ['expanded' => $state['expanded'], 'focused' => $to];
                        $effects[] = self::focus("header:$to");
                    }
                }
            }
        }
        if ($changed) {
            array_unshift($effects, self::change('expanded', $next['expanded']));
        }
        return [$next, $effects];
    }

    public function attrs(object $ctx, array $state): array
    {
        $out = ['root' => ['data-orientation' => $ctx->orientation]];
        $set = array_fill_keys($state['expanded'], true);
        foreach ($ctx->items as $it) {
            $open = isset($set[$it->id]);
            $hid = "{$ctx->base}-header-{$it->id}";
            $pid = "{$ctx->base}-panel-{$it->id}";
            $header = ['id' => $hid, 'aria-expanded' => Util::boolAttr($open), 'aria-controls' => $pid];
            if ($it->disabled || ($open && !$ctx->collapsible && count($set) === 1)) {
                $header['aria-disabled'] = 'true';
            }
            $header['data-state'] = self::stateAttr($open);
            $panel = ['id' => $pid, 'role' => 'region', 'aria-labelledby' => $hid, 'data-state' => self::stateAttr($open)];
            if (!$open) {
                $panel['hidden'] = true;
            }
            $out["header:{$it->id}"] = $header;
            $out["panel:{$it->id}"] = $panel;
        }
        return $out;
    }
}

final class TabsComponent extends Component
{
    public string $name = 'tabs';

    protected function events(): array
    {
        return ['select' => ['req' => ['id' => 'id']], 'focus' => ['req' => ['id' => 'id']], 'blur' => [], 'keydown' => self::KEYDOWN];
    }

    public function setup(mixed $options): array
    {
        $r = new Reader($options, 'invalid_option', 'options', ['idBase', 'items', 'defaultSelected', 'activation', 'orientation', 'dir', 'loop']);
        $items = Item::readList($r->raw('items'), 'invalid_option');
        $ctx = (object) [
            'base' => $r->idBase(),
            'items' => $items,
            'activation' => $r->oneOf('activation', ['automatic', 'manual'], 'automatic'),
            'orientation' => $r->oneOf('orientation', ['horizontal', 'vertical'], 'horizontal'),
            'dir' => $r->oneOf('dir', ['ltr', 'rtl'], 'ltr'),
            'loop' => $r->bool('loop', true),
        ];
        $selected = Util::firstEnabled($items);
        if ($selected === null) {
            $r->bad('items', 'must contain at least one enabled item');
        }
        if ($r->has('defaultSelected')) {
            $it = Util::findItem($items, $r->raw('defaultSelected'));
            if ($it === null || $it->disabled) {
                $r->bad('defaultSelected', 'must be the id of an enabled item');
            }
            $selected = $it->id;
        }
        return [$ctx, ['selected' => $selected, 'focused' => null]];
    }

    public function send(object $ctx, array $state, mixed $event): array
    {
        $e = $this->readEvent($event);
        $effects = [];
        $next = $state;
        $t = $e['type'];
        if ($t === 'select') {
            $it = self::item($ctx->items, $e['id'], 'select');
            if (!$it->disabled) {
                $next = ['selected' => $it->id, 'focused' => $it->id];
            }
        } elseif ($t === 'focus') {
            $next = ['selected' => $state['selected'], 'focused' => self::item($ctx->items, $e['id'], 'focus')->id];
        } elseif ($t === 'blur') {
            $next = ['selected' => $state['selected'], 'focused' => null];
        } elseif ($state['focused'] !== null && !self::hasModifier($e)) {
            $key = $e['key'];
            if ($key === 'Enter' || $key === ' ') {
                if (!self::item($ctx->items, $state['focused'], 'keydown')->disabled) {
                    $next = ['selected' => $state['focused'], 'focused' => $state['focused']];
                }
            } else {
                $move = Util::keyMove($key, $ctx->orientation, $ctx->dir);
                if ($move !== null) {
                    $to = Util::navigate($ctx->items, $state['focused'], $move, $ctx->loop);
                    if ($to !== null && $to !== $state['focused']) {
                        $next = ['selected' => $ctx->activation === 'automatic' ? $to : $state['selected'], 'focused' => $to];
                        $effects[] = self::focus("tab:$to");
                    }
                }
            }
        }
        if ($next['selected'] !== $state['selected']) {
            array_unshift($effects, self::change('selected', $next['selected']));
        }
        return [$next, $effects];
    }

    public function attrs(object $ctx, array $state): array
    {
        $out = ['tablist' => ['role' => 'tablist', 'aria-orientation' => $ctx->orientation]];
        $tabbable = $state['focused'] ?? $state['selected'];
        foreach ($ctx->items as $it) {
            $sel = $it->id === $state['selected'];
            $tid = "{$ctx->base}-tab-{$it->id}";
            $pid = "{$ctx->base}-panel-{$it->id}";
            $tab = ['id' => $tid, 'role' => 'tab', 'aria-selected' => Util::boolAttr($sel), 'aria-controls' => $pid];
            if ($it->disabled) {
                $tab['aria-disabled'] = 'true';
            }
            $tab['tabindex'] = $it->id === $tabbable ? '0' : '-1';
            $tab['data-state'] = $sel ? 'active' : 'inactive';
            $panel = ['id' => $pid, 'role' => 'tabpanel', 'aria-labelledby' => $tid, 'tabindex' => '0', 'data-state' => $sel ? 'active' : 'inactive'];
            if (!$sel) {
                $panel['hidden'] = true;
            }
            $out["tab:{$it->id}"] = $tab;
            $out["panel:{$it->id}"] = $panel;
        }
        return $out;
    }
}

final class ListboxComponent extends Component
{
    public string $name = 'listbox';

    protected function events(): array
    {
        return ['focus' => [], 'blur' => [], 'highlight' => ['req' => ['id' => 'id']], 'select' => ['req' => ['id' => 'id']], 'keydown' => self::KEYDOWN];
    }

    public function setup(mixed $options): array
    {
        $r = new Reader($options, 'invalid_option', 'options', ['idBase', 'items', 'multiple', 'defaultSelected', 'orientation', 'dir', 'loop', 'selectionFollowsFocus', 'typeaheadTimeout']);
        $items = Item::readList($r->raw('items'), 'invalid_option');
        $ctx = (object) [
            'base' => $r->idBase(),
            'items' => $items,
            'multiple' => $r->bool('multiple', false),
            'orientation' => $r->oneOf('orientation', ['vertical', 'horizontal'], 'vertical'),
            'dir' => $r->oneOf('dir', ['ltr', 'rtl'], 'ltr'),
            'loop' => $r->bool('loop', false),
            'follows' => $r->bool('selectionFollowsFocus', false),
            'timeout' => $r->int('typeaheadTimeout', 0, 60000, 500),
        ];
        if ($ctx->multiple && $ctx->follows) {
            $r->bad('selectionFollowsFocus', 'requires multiple to be false');
        }
        $selected = self::readIdList($r, 'defaultSelected', $items);
        if (!$ctx->multiple && count($selected) > 1) {
            $r->bad('defaultSelected', 'may hold at most one id unless multiple is true');
        }
        return [$ctx, ['focused' => null, 'selected' => $selected, 'query' => '', 'queryAt' => null]];
    }

    public function send(object $ctx, array $state, mixed $event): array
    {
        $e = $this->readEvent($event);
        $focused = $state['focused'];
        $selected = $state['selected'];
        $query = $state['query'];
        $queryAt = $state['queryAt'];
        $changed = false;

        $choose = function (string $id) use ($ctx, &$selected, &$changed): void {
            if ($ctx->multiple) {
                $set = array_fill_keys($selected, true);
                if (isset($set[$id])) {
                    unset($set[$id]);
                } else {
                    $set[$id] = true;
                }
                $selected = Util::ordered($ctx->items, $set);
                $changed = true;
            } elseif (count($selected) !== 1 || $selected[0] !== $id) {
                $selected = [$id];
                $changed = true;
            }
        };
        $moveTo = function (?string $id) use ($ctx, &$focused, $choose): void {
            if ($id === null || $id === $focused) {
                return;
            }
            $focused = $id;
            if ($ctx->follows) {
                $choose($id);
            }
        };

        $t = $e['type'];
        if ($t === 'focus') {
            if ($focused === null) {
                $focused = $selected !== [] ? $selected[0] : Util::firstEnabled($ctx->items);
            }
        } elseif ($t === 'blur') {
            $focused = null;
            $query = '';
            $queryAt = null;
        } elseif ($t === 'highlight' || $t === 'select') {
            $it = self::item($ctx->items, $e['id'], $t);
            if (!$it->disabled) {
                $focused = $it->id;
                if ($t === 'select') {
                    $choose($it->id);
                }
            }
        } elseif ($focused !== null) {
            $key = $e['key'];
            $ctrlA = $ctx->multiple && (($e['ctrl'] ?? null) === true || ($e['meta'] ?? null) === true) && ($e['alt'] ?? null) !== true && ($key === 'a' || $key === 'A');
            if ($ctrlA) {
                $enabled = [];
                foreach ($ctx->items as $it) {
                    if (!$it->disabled) {
                        $enabled[] = $it->id;
                    }
                }
                $all = true;
                foreach ($enabled as $id) {
                    if (!in_array($id, $selected, true)) {
                        $all = false;
                    }
                }
                $selected = $all ? [] : $enabled;
                $changed = true;
            } elseif (!self::hasModifier($e)) {
                $move = Util::keyMove($key, $ctx->orientation, $ctx->dir);
                if ($move !== null) {
                    $moveTo(Util::navigate($ctx->items, $focused, $move, $ctx->loop));
                } elseif ($key === ' ' || $key === 'Enter') {
                    $it = Util::findItem($ctx->items, $focused);
                    if ($it !== null && !$it->disabled) {
                        $choose($focused);
                    }
                } elseif (Util::isCharKey($key)) {
                    if (!array_key_exists('at', $e)) {
                        Util::fail('invalid_event', 'keydown with a character key requires at');
                    }
                    [$query, $queryAt, $match] = Util::typeahead($ctx->items, $focused, $query, $queryAt, $key, $e['at'], $ctx->timeout);
                    $moveTo($match);
                }
            }
        }
        $effects = $changed ? [self::change('selected', $selected)] : [];
        return [['focused' => $focused, 'selected' => $selected, 'query' => $query, 'queryAt' => $queryAt], $effects];
    }

    public function attrs(object $ctx, array $state): array
    {
        $lb = ['id' => "{$ctx->base}-listbox", 'role' => 'listbox'];
        if ($ctx->multiple) {
            $lb['aria-multiselectable'] = 'true';
        }
        $lb['aria-orientation'] = $ctx->orientation;
        if ($state['focused'] !== null) {
            $lb['aria-activedescendant'] = "{$ctx->base}-option-{$state['focused']}";
        }
        $lb['tabindex'] = '0';
        $out = ['listbox' => $lb];
        $sel = array_fill_keys($state['selected'], true);
        foreach ($ctx->items as $it) {
            $o = ['id' => "{$ctx->base}-option-{$it->id}", 'role' => 'option', 'aria-selected' => Util::boolAttr(isset($sel[$it->id]))];
            if ($it->disabled) {
                $o['aria-disabled'] = 'true';
            }
            if ($it->id === $state['focused']) {
                $o['data-highlighted'] = true;
            }
            $out["option:{$it->id}"] = $o;
        }
        return $out;
    }
}

final class MenuComponent extends Component
{
    public string $name = 'menu';

    protected function events(): array
    {
        return [
            'triggerClick' => [],
            'triggerKeydown' => self::KEYDOWN,
            'keydown' => self::KEYDOWN,
            'highlight' => ['req' => ['id' => 'id']],
            'itemClick' => ['req' => ['id' => 'id']],
            'outsideClick' => [],
            'close' => [],
        ];
    }

    public function setup(mixed $options): array
    {
        $r = new Reader($options, 'invalid_option', 'options', ['idBase', 'items', 'loop', 'typeaheadTimeout']);
        $ctx = (object) [
            'base' => $r->idBase(),
            'items' => Item::readList($r->raw('items'), 'invalid_option'),
            'loop' => $r->bool('loop', true),
            'timeout' => $r->int('typeaheadTimeout', 0, 60000, 500),
        ];
        return [$ctx, ['open' => false, 'focused' => null, 'query' => '', 'queryAt' => null]];
    }

    public function send(object $ctx, array $state, mixed $event): array
    {
        $e = $this->readEvent($event);
        $effects = [];
        $closed = ['open' => false, 'focused' => null, 'query' => '', 'queryAt' => null];
        $openAt = fn (string $move): array => ['open' => true, 'focused' => Util::navigate($ctx->items, null, $move, false), 'query' => '', 'queryAt' => null];
        $close = function (bool $restore, ?string $select) use (&$effects, $closed): array {
            if ($select !== null) {
                $effects[] = ['type' => 'select', 'id' => $select];
            }
            $effects[] = self::change('open', false);
            if ($restore) {
                $effects[] = self::focus('trigger');
            }
            return [$closed, $effects];
        };
        $opened = function (array $s) use (&$effects, $state): array {
            if (!$state['open']) {
                $effects[] = self::change('open', true);
            }
            $effects[] = self::focus('menu');
            return [$s, $effects];
        };

        $t = $e['type'];
        if ($t === 'triggerClick') {
            return $state['open'] ? $close(true, null) : $opened($openAt('first'));
        }
        if ($t === 'triggerKeydown') {
            if (!self::hasModifier($e)) {
                $key = $e['key'];
                if ($key === 'ArrowDown' || $key === 'Enter' || $key === ' ') {
                    return $opened($openAt('first'));
                }
                if ($key === 'ArrowUp') {
                    return $opened($openAt('last'));
                }
            }
        } elseif ($t === 'outsideClick' || $t === 'close') {
            if ($state['open']) {
                return $close(false, null);
            }
        } elseif ($t === 'highlight' || $t === 'itemClick') {
            $it = self::item($ctx->items, $e['id'], $t);
            if ($state['open'] && !$it->disabled) {
                if ($t === 'itemClick') {
                    return $close(true, $it->id);
                }
                return [['open' => true, 'focused' => $it->id, 'query' => $state['query'], 'queryAt' => $state['queryAt']], $effects];
            }
        } elseif ($t === 'keydown' && $state['open']) {
            $key = $e['key'];
            if ($key === 'Escape') {
                return $close(true, null);
            }
            if ($key === 'Tab') {
                return $close(false, null);
            }
            if (!self::hasModifier($e)) {
                if (($key === 'Enter' || $key === ' ') && $state['focused'] !== null) {
                    return $close(true, $state['focused']);
                }
                $move = Util::keyMove($key, 'vertical', 'ltr');
                if ($move !== null) {
                    return [['open' => true, 'focused' => Util::navigate($ctx->items, $state['focused'], $move, $ctx->loop), 'query' => $state['query'], 'queryAt' => $state['queryAt']], $effects];
                }
                if (Util::isCharKey($key)) {
                    if (!array_key_exists('at', $e)) {
                        Util::fail('invalid_event', 'keydown with a character key requires at');
                    }
                    [$q, $qa, $match] = Util::typeahead($ctx->items, $state['focused'], $state['query'], $state['queryAt'], $key, $e['at'], $ctx->timeout);
                    return [['open' => true, 'focused' => $match ?? $state['focused'], 'query' => $q, 'queryAt' => $qa], $effects];
                }
            }
        }
        return [$state, $effects];
    }

    public function attrs(object $ctx, array $state): array
    {
        $b = $ctx->base;
        $trigger = ['id' => "$b-trigger", 'aria-haspopup' => 'menu', 'aria-expanded' => Util::boolAttr($state['open']), 'aria-controls' => "$b-menu", 'data-state' => self::stateAttr($state['open'])];
        $m = ['id' => "$b-menu", 'role' => 'menu', 'aria-labelledby' => "$b-trigger"];
        if ($state['open'] && $state['focused'] !== null) {
            $m['aria-activedescendant'] = "$b-item-{$state['focused']}";
        }
        $m['tabindex'] = '-1';
        $m['data-state'] = self::stateAttr($state['open']);
        if (!$state['open']) {
            $m['hidden'] = true;
        }
        $out = ['trigger' => $trigger, 'menu' => $m];
        foreach ($ctx->items as $it) {
            $a = ['id' => "$b-item-{$it->id}", 'role' => 'menuitem'];
            if ($it->disabled) {
                $a['aria-disabled'] = 'true';
            }
            $a['tabindex'] = '-1';
            if ($state['open'] && $it->id === $state['focused']) {
                $a['data-highlighted'] = true;
            }
            $out["item:{$it->id}"] = $a;
        }
        return $out;
    }
}

final class ComboboxComponent extends Component
{
    public string $name = 'combobox';

    protected function events(): array
    {
        return [
            'input' => ['req' => ['value' => 'text']],
            'keydown' => self::KEYDOWN,
            'highlight' => ['req' => ['id' => 'id']],
            'select' => ['req' => ['id' => 'id']],
            'open' => [],
            'close' => [],
            'blur' => [],
        ];
    }

    /**
     * Filters items by their label (SPEC 5.6): ASCII case-insensitive.
     * @param list<Item> $items
     * @return list<string>
     */
    public static function filterItems(array $items, string $value, string $mode): array
    {
        $needle = Util::fold($value);
        $out = [];
        foreach ($items as $it) {
            $label = Util::fold($it->label);
            if ($mode === 'none' || $needle === '' || ($mode === 'contains' ? str_contains($label, $needle) : str_starts_with($label, $needle))) {
                $out[] = $it->id;
            }
        }
        return $out;
    }

    public function setup(mixed $options): array
    {
        $r = new Reader($options, 'invalid_option', 'options', ['idBase', 'items', 'defaultSelected', 'filter', 'loop']);
        $ctx = (object) [
            'base' => $r->idBase(),
            'items' => Item::readList($r->raw('items'), 'invalid_option'),
            'filter' => $r->oneOf('filter', ['contains', 'startsWith', 'none'], 'contains'),
            'loop' => $r->bool('loop', true),
        ];
        $selected = null;
        $inputValue = '';
        if ($r->has('defaultSelected') && $r->raw('defaultSelected') !== null) {
            $it = Util::findItem($ctx->items, $r->raw('defaultSelected'));
            if ($it === null) {
                $r->bad('defaultSelected', 'must be the id of an item');
            }
            $selected = $it->id;
            $inputValue = $it->label;
        }
        return [$ctx, ['inputValue' => $inputValue, 'open' => false, 'active' => null, 'selected' => $selected, 'visible' => self::filterItems($ctx->items, $inputValue, $ctx->filter)]];
    }

    public function send(object $ctx, array $state, mixed $event): array
    {
        $e = $this->readEvent($event);
        $inputValue = $state['inputValue'];
        $open = $state['open'];
        $active = $state['active'];
        $selected = $state['selected'];
        $visible = $state['visible'];
        $selectEffects = [];

        $visibleItems = function () use ($ctx, &$visible): array {
            $set = array_fill_keys($visible, true);
            return array_values(array_filter($ctx->items, fn (Item $it) => isset($set[$it->id])));
        };
        $commit = function (Item $it) use ($ctx, &$selectEffects, &$selected, &$inputValue, &$open, &$active, &$visible): void {
            $selectEffects[] = ['type' => 'select', 'id' => $it->id];
            $selected = $it->id;
            $inputValue = $it->label;
            $open = false;
            $active = null;
            $visible = self::filterItems($ctx->items, $inputValue, $ctx->filter);
        };
        $usable = function (mixed $id) use ($ctx, &$visible, $e): ?Item {
            $it = self::item($ctx->items, $id, $e['type']);
            return !$it->disabled && in_array($it->id, $visible, true) ? $it : null;
        };

        $t = $e['type'];
        if ($t === 'input') {
            $inputValue = $e['value'];
            $visible = self::filterItems($ctx->items, $inputValue, $ctx->filter);
            $open = $visible !== [];
            $active = null;
        } elseif ($t === 'open') {
            $visible = self::filterItems($ctx->items, $inputValue, $ctx->filter);
            $open = $visible !== [];
        } elseif ($t === 'close' || $t === 'blur') {
            $open = false;
            $active = null;
        } elseif ($t === 'highlight') {
            $it = $usable($e['id']);
            if ($it !== null && $open) {
                $active = $it->id;
            }
        } elseif ($t === 'select') {
            $it = $usable($e['id']);
            if ($it !== null && $open) {
                $commit($it);
            }
        } elseif ($t === 'keydown' && !(($e['ctrl'] ?? null) === true || ($e['meta'] ?? null) === true)) {
            $key = $e['key'];
            $alt = ($e['alt'] ?? null) === true;
            if ($key === 'ArrowDown' || $key === 'ArrowUp') {
                $down = $key === 'ArrowDown';
                if (!$open) {
                    $visible = self::filterItems($ctx->items, $inputValue, $ctx->filter);
                    if ($visible !== []) {
                        $open = true;
                        $active = $alt ? null : Util::navigate($visibleItems(), null, $down ? 'first' : 'last', false);
                    }
                } elseif (!$alt) {
                    $active = Util::navigate($visibleItems(), $active, $down ? 'next' : 'prev', $ctx->loop);
                }
            } elseif ($key === 'Enter') {
                if ($open && $active !== null) {
                    $commit(Util::findItem($ctx->items, $active));
                }
            } elseif ($key === 'Escape') {
                if ($open) {
                    $open = false;
                    $active = null;
                } elseif ($inputValue !== '') {
                    $inputValue = '';
                    $selected = null;
                    $visible = self::filterItems($ctx->items, $inputValue, $ctx->filter);
                }
            } elseif ($key === 'Tab') {
                $open = false;
                $active = null;
            }
        }
        $effects = $selectEffects;
        if ($selected !== $state['selected']) {
            $effects[] = self::change('selected', $selected);
        }
        if ($open !== $state['open']) {
            $effects[] = self::change('open', $open);
        }
        return [['inputValue' => $inputValue, 'open' => $open, 'active' => $active, 'selected' => $selected, 'visible' => $visible], $effects];
    }

    public function attrs(object $ctx, array $state): array
    {
        $b = $ctx->base;
        $input = ['id' => "$b-input", 'role' => 'combobox', 'aria-expanded' => Util::boolAttr($state['open']), 'aria-controls' => "$b-listbox", 'aria-autocomplete' => 'list'];
        if ($state['active'] !== null) {
            $input['aria-activedescendant'] = "$b-option-{$state['active']}";
        }
        $input['autocomplete'] = 'off';
        $input['data-state'] = self::stateAttr($state['open']);
        $lb = ['id' => "$b-listbox", 'role' => 'listbox', 'aria-labelledby' => "$b-label", 'data-state' => self::stateAttr($state['open'])];
        if (!$state['open']) {
            $lb['hidden'] = true;
        }
        $out = ['label' => ['id' => "$b-label", 'for' => "$b-input"], 'input' => $input, 'listbox' => $lb];
        $vis = array_fill_keys($state['visible'], true);
        foreach ($ctx->items as $it) {
            $o = ['id' => "$b-option-{$it->id}", 'role' => 'option', 'aria-selected' => Util::boolAttr($it->id === $state['selected'])];
            if ($it->disabled) {
                $o['aria-disabled'] = 'true';
            }
            if ($it->id === $state['active']) {
                $o['data-highlighted'] = true;
            }
            if (!isset($vis[$it->id])) {
                $o['hidden'] = true;
            }
            $out["option:{$it->id}"] = $o;
        }
        return $out;
    }
}

final class DialogComponent extends Component
{
    public string $name = 'dialog';

    protected function events(): array
    {
        return ['open' => [], 'close' => [], 'escape' => [], 'outsideClick' => []];
    }

    public function setup(mixed $options): array
    {
        $r = new Reader($options, 'invalid_option', 'options', ['idBase', 'role', 'modal', 'defaultOpen', 'closeOnEscape', 'closeOnOutsideClick', 'description']);
        $role = $r->oneOf('role', ['dialog', 'alertdialog'], 'dialog');
        $ctx = (object) [
            'base' => $r->idBase(),
            'role' => $role,
            'modal' => $r->bool('modal', true),
            'closeOnEscape' => $r->bool('closeOnEscape', true),
            'closeOnOutsideClick' => $r->bool('closeOnOutsideClick', $role === 'dialog'),
            'description' => $r->bool('description', true),
        ];
        return [$ctx, ['open' => $r->bool('defaultOpen', false)]];
    }

    public function send(object $ctx, array $state, mixed $event): array
    {
        $e = $this->readEvent($event);
        $t = $e['type'];
        $open = $state['open'];
        if ($t === 'open') {
            $open = true;
        } elseif ($t === 'close') {
            $open = false;
        } elseif ($t === 'escape' && $ctx->closeOnEscape) {
            $open = false;
        } elseif ($t === 'outsideClick' && $ctx->closeOnOutsideClick) {
            $open = false;
        }
        if ($open === $state['open']) {
            return [$state, []];
        }
        $effects = [self::change('open', $open)];
        if ($open) {
            if ($ctx->modal) {
                $effects[] = ['type' => 'lockScroll'];
                $effects[] = ['type' => 'trapFocus'];
            }
            $effects[] = self::focus('initial');
        } else {
            if ($ctx->modal) {
                $effects[] = ['type' => 'releaseFocus'];
                $effects[] = ['type' => 'unlockScroll'];
            }
            $effects[] = ['type' => 'restoreFocus'];
        }
        return [['open' => $open], $effects];
    }

    public function attrs(object $ctx, array $state): array
    {
        $b = $ctx->base;
        $d = ['id' => "$b-dialog", 'role' => $ctx->role];
        if ($ctx->modal) {
            $d['aria-modal'] = 'true';
        }
        $d['aria-labelledby'] = "$b-title";
        if ($ctx->description) {
            $d['aria-describedby'] = "$b-description";
        }
        $d['tabindex'] = '-1';
        $d['data-state'] = self::stateAttr($state['open']);
        if (!$state['open']) {
            $d['hidden'] = true;
        }
        $out = [
            'trigger' => ['aria-haspopup' => 'dialog', 'aria-expanded' => Util::boolAttr($state['open']), 'aria-controls' => "$b-dialog", 'data-state' => self::stateAttr($state['open'])],
            'dialog' => $d,
            'title' => ['id' => "$b-title"],
        ];
        if ($ctx->description) {
            $out['description'] = ['id' => "$b-description"];
        }
        return $out;
    }
}

final class ToggleComponent extends Component
{
    private bool $tri;
    /** @var list<string> */
    private array $keys;

    public function __construct(string $name)
    {
        $this->name = $name;
        $this->tri = $name === 'checkbox';
        $this->keys = $this->tri ? [' '] : [' ', 'Enter'];
    }

    protected function events(): array
    {
        return ['toggle' => [], 'set' => ['req' => ['checked' => 'check']], 'keydown' => self::KEYDOWN];
    }

    public function setup(mixed $options): array
    {
        $r = new Reader($options, 'invalid_option', 'options', ['idBase', 'defaultChecked', 'disabled']);
        $checked = false;
        if ($r->has('defaultChecked')) {
            $v = $r->raw('defaultChecked');
            if (!(is_bool($v) || ($this->tri && $v === 'mixed'))) {
                $r->bad('defaultChecked', $this->tri ? 'must be true, false or "mixed"' : 'must be a boolean');
            }
            $checked = $v;
        }
        return [(object) ['base' => $r->idBase(), 'disabled' => $r->bool('disabled', false)], ['checked' => $checked]];
    }

    public function send(object $ctx, array $state, mixed $event): array
    {
        $e = $this->readEvent($event);
        $checked = $state['checked'];
        if ($e['type'] === 'set') {
            if (!$this->tri && $e['checked'] === 'mixed') {
                Util::fail('invalid_event', 'set.checked must be a boolean for switch');
            }
            if (!$ctx->disabled) {
                $checked = $e['checked'];
            }
        } elseif (!$ctx->disabled && ($e['type'] === 'toggle' || (!self::hasModifier($e) && in_array($e['key'], $this->keys, true)))) {
            $checked = $checked !== true;
        }
        if ($checked === $state['checked']) {
            return [$state, []];
        }
        return [['checked' => $checked], [self::change('checked', $checked)]];
    }

    public function attrs(object $ctx, array $state): array
    {
        $c = $state['checked'];
        $control = ['id' => "{$ctx->base}-control", 'role' => $this->name, 'aria-checked' => $c === 'mixed' ? 'mixed' : Util::boolAttr($c)];
        if ($ctx->disabled) {
            $control['aria-disabled'] = 'true';
        }
        $control['tabindex'] = $ctx->disabled ? '-1' : '0';
        $control['data-state'] = $c === 'mixed' ? 'indeterminate' : ($c ? 'checked' : 'unchecked');
        return ['control' => $control];
    }
}

final class RadioGroupComponent extends Component
{
    public string $name = 'radiogroup';

    protected function events(): array
    {
        return ['select' => ['req' => ['id' => 'id']], 'focus' => ['req' => ['id' => 'id']], 'blur' => [], 'keydown' => self::KEYDOWN];
    }

    public function setup(mixed $options): array
    {
        $r = new Reader($options, 'invalid_option', 'options', ['idBase', 'items', 'defaultValue', 'dir', 'loop', 'disabled']);
        $ctx = (object) [
            'base' => $r->idBase(),
            'items' => Item::readList($r->raw('items'), 'invalid_option'),
            'dir' => $r->oneOf('dir', ['ltr', 'rtl'], 'ltr'),
            'loop' => $r->bool('loop', true),
            'disabled' => $r->bool('disabled', false),
        ];
        $value = null;
        if ($r->has('defaultValue') && $r->raw('defaultValue') !== null) {
            $it = Util::findItem($ctx->items, $r->raw('defaultValue'));
            if ($it === null || $it->disabled) {
                $r->bad('defaultValue', 'must be the id of an enabled item');
            }
            $value = $it->id;
        }
        return [$ctx, ['value' => $value, 'focused' => null]];
    }

    public function send(object $ctx, array $state, mixed $event): array
    {
        $e = $this->readEvent($event);
        $effects = [];
        $value = $state['value'];
        $focused = $state['focused'];
        $t = $e['type'];
        if ($t === 'select' || $t === 'focus') {
            $it = self::item($ctx->items, $e['id'], $t);
            if ($t === 'focus') {
                $focused = $it->id;
            } elseif (!$ctx->disabled && !$it->disabled) {
                $value = $it->id;
                $focused = $it->id;
            }
        } elseif ($t === 'blur') {
            $focused = null;
        } elseif ($focused !== null && !$ctx->disabled && !self::hasModifier($e)) {
            $key = $e['key'];
            if ($key === ' ') {
                if (!Util::findItem($ctx->items, $focused)->disabled) {
                    $value = $focused;
                }
            } else {
                $move = Util::keyMove($key, 'both', $ctx->dir);
                if ($move !== null) {
                    $to = Util::navigate($ctx->items, $focused, $move, $ctx->loop);
                    if ($to !== null && !Util::findItem($ctx->items, $to)->disabled) {
                        if ($to !== $focused) {
                            $effects[] = self::focus("radio:$to");
                        }
                        $focused = $to;
                        $value = $to;
                    }
                }
            }
        }
        if ($value !== $state['value']) {
            array_unshift($effects, self::change('value', $value));
        }
        return [['value' => $value, 'focused' => $focused], $effects];
    }

    public function attrs(object $ctx, array $state): array
    {
        $group = ['role' => 'radiogroup'];
        if ($ctx->disabled) {
            $group['aria-disabled'] = 'true';
        }
        $out = ['group' => $group];
        $tabbable = $state['focused'] ?? $state['value'] ?? Util::firstEnabled($ctx->items);
        foreach ($ctx->items as $it) {
            $on = $it->id === $state['value'];
            $a = ['id' => "{$ctx->base}-radio-{$it->id}", 'role' => 'radio', 'aria-checked' => Util::boolAttr($on)];
            if ($it->disabled || $ctx->disabled) {
                $a['aria-disabled'] = 'true';
            }
            $a['tabindex'] = !$ctx->disabled && $it->id === $tabbable ? '0' : '-1';
            $a['data-state'] = $on ? 'checked' : 'unchecked';
            $out["radio:{$it->id}"] = $a;
        }
        return $out;
    }
}

final class SliderComponent extends Component
{
    public string $name = 'slider';
    private const LIMIT = 4503599627370496; // 2^52

    protected function events(): array
    {
        return ['set' => ['req' => ['value' => 'number']], 'keydown' => self::KEYDOWN];
    }

    public static function value(object $ctx, int $k): float
    {
        return ($ctx->mi + $k * $ctx->st) / $ctx->D;
    }

    public static function snap(object $ctx, float $v): int
    {
        $k = (int) floor(($v * $ctx->D - $ctx->mi) / $ctx->st + 0.5);
        return min(max($k, 0), $ctx->kmax);
    }

    public function setup(mixed $options): array
    {
        $r = new Reader($options, 'invalid_option', 'options', ['idBase', 'min', 'max', 'step', 'largeStep', 'defaultValue', 'orientation', 'dir', 'disabled']);
        $lo = $r->num('min', 0);
        $hi = $r->num('max', 100);
        $step = $r->num('step', 1);
        if (!($lo < $hi)) {
            $r->bad('max', 'must be greater than min');
        }
        if (!($step > 0)) {
            $r->bad('step', 'must be greater than 0');
        }
        $large = $r->has('largeStep') ? $r->num('largeStep', 0) : null;
        if ($large !== null && !($large > 0)) {
            $r->bad('largeStep', 'must be greater than 0');
        }
        $d = max(Util::decimalsOf($lo), Util::decimalsOf($hi), Util::decimalsOf($step), $large === null ? 0 : Util::decimalsOf($large));
        if ($d > 10) {
            $r->bad('step', 'values may have at most 10 decimal digits');
        }
        $D = 10 ** $d;
        $mi = (int) round($lo * $D);
        $ma = (int) round($hi * $D);
        $st = (int) round($step * $D);
        if (abs($mi) > self::LIMIT || abs($ma) > self::LIMIT || $st > self::LIMIT || $st < 1) {
            $r->bad('max', 'range is too large for exact arithmetic');
        }
        $span = $ma - $mi;
        $kmax = intdiv($span - $span % $st, $st);
        $kl = max(1, intdiv($kmax, 10));
        if ($large !== null) {
            $kl = (int) floor(($large * $D) / $st + 0.5);
            if ($kl < 1) {
                $r->bad('largeStep', 'must be at least one step');
            }
        }
        $ctx = (object) [
            'base' => $r->idBase(), 'd' => $d, 'D' => $D, 'mi' => $mi, 'st' => $st, 'kmax' => $kmax, 'kl' => $kl,
            'orientation' => $r->oneOf('orientation', ['horizontal', 'vertical'], 'horizontal'),
            'dir' => $r->oneOf('dir', ['ltr', 'rtl'], 'ltr'),
            'disabled' => $r->bool('disabled', false),
        ];
        $k = self::snap($ctx, $r->num('defaultValue', $lo));
        return [$ctx, ['value' => self::value($ctx, $k)]];
    }

    public function send(object $ctx, array $state, mixed $event): array
    {
        $e = $this->readEvent($event);
        if ($ctx->disabled) {
            return [$state, []];
        }
        $k0 = self::snap($ctx, (float) $state['value']);
        $k = $k0;
        if ($e['type'] === 'set') {
            $k = self::snap($ctx, $e['value']);
        } elseif (!self::hasModifier($e)) {
            $flip = $ctx->orientation === 'horizontal' && $ctx->dir === 'rtl' ? -1 : 1;
            $k = match ($e['key']) {
                'ArrowUp' => $k0 + 1,
                'ArrowDown' => $k0 - 1,
                'ArrowRight' => $k0 + $flip,
                'ArrowLeft' => $k0 - $flip,
                'PageUp' => $k0 + $ctx->kl,
                'PageDown' => $k0 - $ctx->kl,
                'Home' => 0,
                'End' => $ctx->kmax,
                default => $k0,
            };
            $k = min(max($k, 0), $ctx->kmax);
        }
        if ($k === $k0) {
            return [$state, []];
        }
        $value = self::value($ctx, $k);
        return [['value' => $value], [self::change('value', $value)]];
    }

    public function attrs(object $ctx, array $state): array
    {
        $fmt = fn (float $v): string => Util::formatNumber($v, $ctx->d);
        $thumb = [
            'id' => "{$ctx->base}-thumb",
            'role' => 'slider',
            'aria-valuemin' => $fmt(self::value($ctx, 0)),
            'aria-valuemax' => $fmt(self::value($ctx, $ctx->kmax)),
            'aria-valuenow' => $fmt((float) $state['value']),
            'aria-orientation' => $ctx->orientation,
        ];
        if ($ctx->disabled) {
            $thumb['aria-disabled'] = 'true';
        }
        $thumb['tabindex'] = $ctx->disabled ? '-1' : '0';
        $thumb['data-orientation'] = $ctx->orientation;
        return ['thumb' => $thumb];
    }
}

final class TooltipComponent extends Component
{
    public string $name = 'tooltip';

    protected function events(): array
    {
        return [
            'pointerEnter' => ['req' => ['at' => 'at']],
            'pointerLeave' => ['req' => ['at' => 'at']],
            'focus' => ['opt' => ['at' => 'at']],
            'blur' => ['opt' => ['at' => 'at']],
            'escape' => ['opt' => ['at' => 'at']],
            'tick' => ['req' => ['at' => 'at']],
        ];
    }

    public function setup(mixed $options): array
    {
        $r = new Reader($options, 'invalid_option', 'options', ['idBase', 'openDelay', 'closeDelay']);
        return [(object) ['base' => $r->idBase(), 'openDelay' => $r->int('openDelay', 0, 60000, 700), 'closeDelay' => $r->int('closeDelay', 0, 60000, 300)], ['open' => false, 'pending' => null, 'dueAt' => null]];
    }

    public function send(object $ctx, array $state, mixed $event): array
    {
        $e = $this->readEvent($event);
        $at = $e['at'] ?? null;
        $next = $state;
        $settle = fn (bool $o): array => ['open' => $o, 'pending' => null, 'dueAt' => null];
        switch ($e['type']) {
            case 'pointerEnter':
                if ($state['open'] || $ctx->openDelay === 0) {
                    $next = $settle(true);
                } elseif ($state['pending'] !== 'open') {
                    $next = ['open' => false, 'pending' => 'open', 'dueAt' => $at + $ctx->openDelay];
                }
                break;
            case 'pointerLeave':
                if (!$state['open'] || $ctx->closeDelay === 0) {
                    $next = $settle(false);
                } elseif ($state['pending'] !== 'close') {
                    $next = ['open' => true, 'pending' => 'close', 'dueAt' => $at + $ctx->closeDelay];
                }
                break;
            case 'focus':
                $next = $settle(true);
                break;
            case 'blur':
            case 'escape':
                $next = $settle(false);
                break;
            case 'tick':
                if ($state['pending'] !== null && $at >= $state['dueAt']) {
                    $next = $settle($state['pending'] === 'open');
                }
                break;
        }
        if ($next['open'] === $state['open'] && $next['pending'] === $state['pending'] && $next['dueAt'] === $state['dueAt']) {
            $next = $state;
        }
        $effects = [];
        if ($next['open'] !== $state['open']) {
            $effects[] = self::change('open', $next['open']);
        }
        if ($next['dueAt'] !== null && $next['dueAt'] !== $state['dueAt']) {
            $effects[] = ['type' => 'schedule', 'at' => $next['dueAt']];
        }
        return [$next, $effects];
    }

    public function attrs(object $ctx, array $state): array
    {
        $trigger = [];
        if ($state['open']) {
            $trigger['aria-describedby'] = "{$ctx->base}-tooltip";
        }
        $trigger['data-state'] = self::stateAttr($state['open']);
        $tip = ['id' => "{$ctx->base}-tooltip", 'role' => 'tooltip', 'data-state' => self::stateAttr($state['open'])];
        if (!$state['open']) {
            $tip['hidden'] = true;
        }
        return ['trigger' => $trigger, 'tooltip' => $tip];
    }
}

final class ToastComponent extends Component
{
    public string $name = 'toast';

    protected function events(): array
    {
        return [
            'add' => ['req' => ['id' => 'id', 'at' => 'at'], 'opt' => ['kind' => 'kind', 'duration' => 'duration']],
            'dismiss' => ['req' => ['id' => 'id', 'at' => 'at']],
            'pause' => ['req' => ['at' => 'at']],
            'resume' => ['req' => ['at' => 'at']],
            'tick' => ['req' => ['at' => 'at']],
            'clear' => [],
        ];
    }

    /** @param list<array<string, mixed>> $items */
    private static function earliest(array $items): ?int
    {
        $m = null;
        foreach ($items as $t) {
            if ($t['deadline'] !== null && ($m === null || $t['deadline'] < $m)) {
                $m = $t['deadline'];
            }
        }
        return $m;
    }

    public function setup(mixed $options): array
    {
        $r = new Reader($options, 'invalid_option', 'options', ['idBase', 'max', 'defaultDuration']);
        $dd = $r->has('defaultDuration') && $r->raw('defaultDuration') === null ? null : $r->int('defaultDuration', 1, Util::MAX_DURATION, 5000);
        return [(object) ['base' => $r->idBase(), 'max' => $r->int('max', 1, 100, 3), 'defaultDuration' => $dd], ['items' => [], 'paused' => false]];
    }

    public function send(object $ctx, array $state, mixed $event): array
    {
        $e = $this->readEvent($event);
        $effects = [];
        $items = $state['items'];
        $paused = $state['paused'];
        $at = $e['at'] ?? null;
        $activate = function () use (&$items, &$paused, $ctx, $at): void {
            if ($paused) {
                return;
            }
            for ($i = 0; $i < count($items) && $i < $ctx->max; $i++) {
                if ($items[$i]['remaining'] !== null && $items[$i]['deadline'] === null) {
                    $items[$i]['deadline'] = $at + $items[$i]['remaining'];
                }
            }
        };
        switch ($e['type']) {
            case 'add':
                $id = $e['id'];
                if (!Util::isId($id)) {
                    Util::fail('invalid_event', 'add.id must be an id');
                }
                foreach ($items as $t) {
                    if ($t['id'] === $id) {
                        Util::fail('invalid_event', "add: duplicate toast \"$id\"");
                    }
                }
                $duration = array_key_exists('duration', $e) ? $e['duration'] : $ctx->defaultDuration;
                $items[] = ['id' => $id, 'kind' => $e['kind'] ?? 'info', 'remaining' => $duration, 'deadline' => null];
                $activate();
                break;
            case 'dismiss':
                $before = count($items);
                $items = array_values(array_filter($items, fn ($t) => $t['id'] !== $e['id']));
                if (count($items) !== $before) {
                    $effects[] = ['type' => 'dismiss', 'id' => $e['id'], 'reason' => 'manual'];
                }
                $activate();
                break;
            case 'pause':
                if (!$paused) {
                    $paused = true;
                    foreach ($items as $i => $t) {
                        if ($t['deadline'] !== null) {
                            $items[$i]['remaining'] = max(0, $t['deadline'] - $at);
                            $items[$i]['deadline'] = null;
                        }
                    }
                }
                break;
            case 'resume':
                if ($paused) {
                    $paused = false;
                    $activate();
                }
                break;
            case 'tick':
                $keep = [];
                foreach ($items as $i => $t) {
                    if ($i < $ctx->max && $t['deadline'] !== null && $at >= $t['deadline']) {
                        $effects[] = ['type' => 'dismiss', 'id' => $t['id'], 'reason' => 'timeout'];
                    } else {
                        $keep[] = $t;
                    }
                }
                $items = $keep;
                $activate();
                break;
            case 'clear':
                foreach ($items as $t) {
                    $effects[] = ['type' => 'dismiss', 'id' => $t['id'], 'reason' => 'manual'];
                }
                $items = [];
                break;
        }
        $next = self::earliest($items);
        if ($next !== null && $next !== self::earliest($state['items'])) {
            $effects[] = ['type' => 'schedule', 'at' => $next];
        }
        return [['items' => $items, 'paused' => $paused], $effects];
    }

    public function attrs(object $ctx, array $state): array
    {
        $out = ['region' => ['id' => "{$ctx->base}-region", 'role' => 'region', 'tabindex' => '-1', 'data-paused' => Util::boolAttr($state['paused'])]];
        foreach ($state['items'] as $i => $t) {
            $urgent = $t['kind'] === 'warning' || $t['kind'] === 'danger';
            $a = [
                'id' => "{$ctx->base}-toast-{$t['id']}",
                'role' => $urgent ? 'alert' : 'status',
                'aria-live' => $urgent ? 'assertive' : 'polite',
                'aria-atomic' => 'true',
                'data-kind' => $t['kind'],
            ];
            if ($i >= $ctx->max) {
                $a['hidden'] = true;
            }
            $out["toast:{$t['id']}"] = $a;
        }
        return $out;
    }
}

foreach ([
    new AccordionComponent(), new ToggleComponent('checkbox'), new ComboboxComponent(), new DialogComponent(),
    new DisclosureComponent(), new ListboxComponent(), new MenuComponent(), new RadioGroupComponent(), new SliderComponent(),
    new ToggleComponent('switch'), new TabsComponent(), new ToastComponent(), new TooltipComponent(),
] as $component) {
    Machines::register($component);
}
