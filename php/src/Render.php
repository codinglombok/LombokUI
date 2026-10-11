<?php

declare(strict_types=1);

namespace Lombok\UI;

/** Props reader for render (SPEC 8): errors are `invalid_props`. */
final class Props extends Reader
{
    private const ICON_RE = '/\A[a-z0-9]+(-[a-z0-9]+)*\z/';

    /** @param list<string> $allowed */
    public function __construct(mixed $src, array $allowed)
    {
        parent::__construct($src, 'invalid_props', 'props', $allowed);
    }

    /** @param list<string> $base */
    public function cls(array $base): string
    {
        $extra = $this->text('class', null, 200);
        $t = $extra === null ? '' : Util::trimAscii($extra);
        return $t === '' ? implode(' ', $base) : implode(' ', $base) . ' ' . $t;
    }

    public function iconName(string $key): ?string
    {
        $v = $this->src[$key] ?? null;
        if ($v === null) {
            return null;
        }
        if (!is_string($v) || strlen($v) > 64 || preg_match(self::ICON_RE, $v) !== 1) {
            $this->bad($key, 'must be an icon name such as chevron-down');
        }
        return $v;
    }

    /** @return array<string, string>|null */
    public function labels(): ?array
    {
        $v = $this->src['labels'] ?? null;
        if ($v === null) {
            return null;
        }
        if (!Util::isObject($v)) {
            $this->bad('labels', 'must be an object');
        }
        $out = Util::props($v);
        foreach ($out as $k => $s) {
            if (!in_array($k, Messages::LABEL_KEYS, true)) {
                $this->bad('labels', "has unknown key \"$k\"");
            }
            if (!Util::fitsText($s, Util::MAX_LABEL)) {
                $this->bad('labels', ".$k must be a string");
            }
        }
        return $out;
    }

    public function locale(): string
    {
        return (string) $this->text('locale', 'en', 35);
    }

    public function url(string $key): ?string
    {
        $v = $this->text($key, null, 2048);
        return $v === null ? null : Render::safeUrl($v);
    }

    public function lbl(string $key): string
    {
        return Messages::label($this->locale(), $key, $this->labels());
    }
}

/** Server-side rendering to HTML strings with LombokCSS class names (SPEC 8). */
final class Render
{
    public const VARIANTS = ['primary', 'secondary', 'outline', 'soft', 'ghost', 'link', 'danger'];
    private const SAFE_SCHEMES = ['http', 'https', 'mailto', 'tel'];
    private const INPUT_TYPES = ['text', 'email', 'password', 'number', 'tel', 'url', 'search', 'date', 'time', 'datetime-local', 'month', 'week'];
    public const RENDERABLE = ['accordion', 'alert', 'badge', 'breadcrumb', 'button', 'checkbox', 'dialog', 'field', 'menu', 'pagination', 'progress', 'switch', 'tabs'];

    public static function escapeText(string $s): string
    {
        return str_replace(['&', '<', '>'], ['&amp;', '&lt;', '&gt;'], $s);
    }

    public static function escapeAttr(string $s): string
    {
        return str_replace(['"', "'"], ['&quot;', '&#39;'], self::escapeText($s));
    }

    /** Rejects URLs whose scheme is not http, https, mailto or tel (SPEC 8.3). */
    public static function safeUrl(string $href): string
    {
        $probe = (string) preg_replace('/\A[\x00-\x20]+/', '', str_replace(["\t", "\n", "\r"], '', $href));
        if (preg_match('/\A([A-Za-z][A-Za-z0-9+.-]*):/', $probe, $m) === 1 && !in_array(Util::fold($m[1]), self::SAFE_SCHEMES, true)) {
            Util::fail('invalid_props', "href scheme \"{$m[1]}\" is not allowed");
        }
        return $href;
    }

    /** @param list<array{0: string, 1: mixed}> $list */
    private static function attrs(array $list): string
    {
        $out = '';
        foreach ($list as [$k, $v]) {
            if ($v === null || $v === false) {
                continue;
            }
            $out .= $v === true ? " $k" : " $k=\"" . self::escapeAttr((string) $v) . '"';
        }
        return $out;
    }

    /**
     * @param array<string, string|true> $a
     * @param list<string> $skip
     * @return list<array{0: string, 1: mixed}>
     */
    private static function fromMachine(array $a, array $skip = []): array
    {
        $out = [];
        foreach ($a as $k => $v) {
            if (!in_array($k, $skip, true)) {
                $out[] = [$k, $v];
            }
        }
        return $out;
    }

    /** @param list<array{0: string, 1: mixed}> $list */
    private static function el(string $tag, array $list, string $inner): string
    {
        return "<$tag" . self::attrs($list) . ">$inner</$tag>";
    }

    private static function icon(string $name): string
    {
        return '<i data-lf="' . $name . '" aria-hidden="true"></i>';
    }

    private static function button(mixed $props): string
    {
        $p = new Props($props, ['label', 'variant', 'size', 'type', 'disabled', 'block', 'icon', 'iconPosition', 'iconOnly', 'pressed', 'name', 'value', 'id', 'class']);
        $text = $p->reqText('label');
        $variant = $p->oneOf('variant', self::VARIANTS, 'primary');
        $size = $p->oneOf('size', ['sm', 'md', 'lg'], 'md');
        $ic = $p->iconName('icon');
        $iconOnly = $p->bool('iconOnly', false);
        if ($iconOnly && $ic === null) {
            $p->bad('iconOnly', 'requires icon');
        }
        $pos = $p->oneOf('iconPosition', ['start', 'end'], 'start');
        $pressed = $p->src['pressed'] ?? null;
        if ($pressed !== null && !is_bool($pressed)) {
            $p->bad('pressed', 'must be a boolean or null');
        }
        $classes = ['btn', "btn-$variant"];
        if ($size !== 'md') {
            $classes[] = "btn-$size";
        }
        if ($p->bool('block', false)) {
            $classes[] = 'btn-block';
        }
        if ($iconOnly) {
            $classes[] = 'btn-icon';
        }
        if ($ic === null) {
            $inner = self::escapeText($text);
        } elseif ($iconOnly) {
            $inner = self::icon($ic);
        } elseif ($pos === 'start') {
            $inner = self::icon($ic) . '<span>' . self::escapeText($text) . '</span>';
        } else {
            $inner = '<span>' . self::escapeText($text) . '</span>' . self::icon($ic);
        }
        return self::el('button', [
            ['type', $p->oneOf('type', ['button', 'submit', 'reset'], 'button')],
            ['class', $p->cls($classes)],
            ['id', $p->id('id', null)],
            ['name', $p->text('name', null)],
            ['value', $p->text('value', null)],
            ['aria-label', $iconOnly ? $text : null],
            ['aria-pressed', is_bool($pressed) ? Util::boolAttr($pressed) : null],
            ['disabled', $p->bool('disabled', false)],
        ], $inner);
    }

    private static function badge(mixed $props): string
    {
        $p = new Props($props, ['label', 'variant', 'pill', 'class']);
        $text = $p->reqText('label');
        $variant = $p->oneOf('variant', ['default', 'primary', 'success', 'warning', 'danger', 'info', 'solid'], 'default');
        $classes = ['badge'];
        if ($variant !== 'default') {
            $classes[] = "badge-$variant";
        }
        if ($p->bool('pill', false)) {
            $classes[] = 'badge-pill';
        }
        return self::el('span', [['class', $p->cls($classes)]], self::escapeText($text));
    }

    private static function alert(mixed $props): string
    {
        $p = new Props($props, ['kind', 'title', 'body', 'class']);
        $kind = $p->oneOf('kind', ['info', 'success', 'warning', 'danger'], 'info');
        $title = $p->text('title', null);
        $body = $p->reqText('body', 10000);
        $urgent = $kind === 'warning' || $kind === 'danger';
        $inner = ($title === null ? '' : '<div class="alert-title">' . self::escapeText($title) . '</div>') . self::escapeText($body);
        return self::el('div', [['class', $p->cls(['alert', "alert-$kind"])], ['role', $urgent ? 'alert' : 'status']], "<div>$inner</div>");
    }

    private static function reqId(Props $p, string $key = 'id'): string
    {
        $v = $p->id($key, null);
        if ($v === null) {
            $p->bad($key, 'is required');
        }
        return $v;
    }

    private static function field(mixed $props): string
    {
        $p = new Props($props, ['id', 'label', 'type', 'name', 'value', 'placeholder', 'autocomplete', 'help', 'error', 'required', 'disabled', 'readonly', 'class']);
        $id = self::reqId($p);
        $text = $p->reqText('label');
        $help = $p->text('help', null);
        $error = $p->text('error', null);
        $described = implode(' ', array_values(array_filter([$help !== null ? "$id-help" : null, $error !== null ? "$id-error" : null])));
        $input = '<input' . self::attrs([
            ['class', $error !== null ? 'input is-invalid' : 'input'],
            ['id', $id],
            ['type', $p->oneOf('type', self::INPUT_TYPES, 'text')],
            ['name', $p->text('name', null)],
            ['value', $p->text('value', null, 10000)],
            ['placeholder', $p->text('placeholder', null)],
            ['autocomplete', $p->text('autocomplete', null, 100)],
            ['aria-describedby', $described === '' ? null : $described],
            ['aria-invalid', $error !== null ? 'true' : null],
            ['required', $p->bool('required', false)],
            ['disabled', $p->bool('disabled', false)],
            ['readonly', $p->bool('readonly', false)],
        ]) . '>';
        $inner = '<label class="label" for="' . $id . '">' . self::escapeText($text) . '</label>' . $input;
        if ($help !== null) {
            $inner .= '<span class="help" id="' . $id . '-help">' . self::escapeText($help) . '</span>';
        }
        if ($error !== null) {
            $inner .= '<span class="error-text" id="' . $id . '-error">' . self::escapeText($error) . '</span>';
        }
        return self::el('div', [['class', $p->cls(['field'])]], $inner);
    }

    private static function checkbox(mixed $props): string
    {
        $p = new Props($props, ['id', 'label', 'name', 'value', 'checked', 'disabled', 'required', 'class']);
        $id = self::reqId($p);
        $text = $p->reqText('label');
        $input = '<input' . self::attrs([
            ['type', 'checkbox'],
            ['id', $id],
            ['name', $p->text('name', null)],
            ['value', $p->text('value', null)],
            ['checked', $p->bool('checked', false)],
            ['disabled', $p->bool('disabled', false)],
            ['required', $p->bool('required', false)],
        ]) . '>';
        return self::el('div', [['class', $p->cls(['check'])]], $input . '<label for="' . $id . '">' . self::escapeText($text) . '</label>');
    }

    private static function switchHtml(mixed $props): string
    {
        $p = new Props($props, ['id', 'label', 'name', 'value', 'checked', 'disabled', 'class']);
        $text = $p->reqText('label');
        $input = '<input' . self::attrs([
            ['type', 'checkbox'],
            ['role', 'switch'],
            ['id', $p->id('id', null)],
            ['name', $p->text('name', null)],
            ['value', $p->text('value', null)],
            ['checked', $p->bool('checked', false)],
            ['disabled', $p->bool('disabled', false)],
        ]) . '>';
        return self::el('label', [['class', $p->cls(['switch'])]], '<span>' . self::escapeText($text) . '</span>' . $input . '<span class="track"></span>');
    }

    private static function plainNumber(Props $p, string $key, float $v): string
    {
        $d = Util::decimalsOf($v);
        if ($d > 6 || abs($v) > 1e15) {
            $p->bad($key, 'must have at most 6 decimal digits and magnitude at most 1e15');
        }
        return Util::formatNumber($v, $d);
    }

    private static function progress(mixed $props): string
    {
        $p = new Props($props, ['value', 'max', 'label', 'class']);
        if (!Util::isFinite($p->src['value'] ?? null)) {
            $p->bad('value', 'is required and must be a finite number');
        }
        $value = (float) $p->src['value'];
        $max = $p->num('max', 100);
        if (!($max > 0)) {
            $p->bad('max', 'must be greater than 0');
        }
        if ($value < 0 || $value > $max) {
            $p->bad('value', 'must be between 0 and max');
        }
        $text = $p->reqText('label');
        $vs = self::plainNumber($p, 'value', $value);
        $ms = self::plainNumber($p, 'max', $max);
        $n = (int) floor(($value * 10000) / $max + 0.5);
        $pct = Util::formatNumber($n / 100, 2);
        return self::el('div', [['class', $p->cls(['progress'])], ['role', 'progressbar'], ['aria-label', $text], ['aria-valuemin', '0'], ['aria-valuemax', $ms], ['aria-valuenow', $vs]],
            '<div class="bar" style="inline-size:' . $pct . '%"></div>');
    }

    private static function breadcrumb(mixed $props): string
    {
        $p = new Props($props, ['items', 'class', 'locale', 'labels']);
        $raw = $p->src['items'] ?? null;
        if (!Util::isList($raw) || count($raw) < 1 || count($raw) > 100) {
            $p->bad('items', 'must be an array of 1..100 items');
        }
        $lis = '';
        $last = count($raw) - 1;
        foreach ($raw as $i => $it) {
            $r = new Props($it, ['label', 'href']);
            $text = self::escapeText($r->reqText('label'));
            $href = $r->url('href');
            if ($href === null) {
                $lis .= $i === $last ? '<li aria-current="page">' . $text . '</li>' : "<li>$text</li>";
            } else {
                $lis .= '<li>' . self::el('a', [['href', $href], ['aria-current', $i === $last ? 'page' : null]], $text) . '</li>';
            }
        }
        return self::el('nav', [['aria-label', $p->lbl('breadcrumb')]], self::el('ol', [['class', $p->cls(['breadcrumb'])]], $lis));
    }

    private static function pagination(mixed $props): string
    {
        $p = new Props($props, ['page', 'total', 'siblings', 'boundaries', 'href', 'class', 'locale', 'labels']);
        $args = [];
        foreach (['page', 'total', 'siblings', 'boundaries'] as $k) {
            if ($p->has($k)) {
                $args[$k] = $p->src[$k];
            }
        }
        try {
            $model = Layout::pagination((object) $args);
        } catch (LombokUIError $e) {
            Util::fail('invalid_props', $e->getMessage());
        }
        $tpl = $p->text('href', null, 2048);
        if ($tpl !== null && !str_contains($tpl, '{page}')) {
            $p->bad('href', 'must contain {page}');
        }
        if ($tpl !== null) {
            self::safeUrl(str_replace('{page}', '1', $tpl));
        }
        $page = $p->has('page') ? (int) $p->src['page'] : 1;
        $link = fn (int $n, array $list, string $inner): string => $tpl === null
            ? self::el('button', array_merge([['type', 'button'], ['data-page', (string) $n]], $list), $inner)
            : self::el('a', array_merge([['href', str_replace('{page}', (string) $n, $tpl)]], $list), $inner);
        $off = fn (array $list, string $inner): string => $tpl === null
            ? self::el('button', array_merge([['type', 'button'], ['disabled', true]], $list), $inner)
            : self::el('a', array_merge([['aria-disabled', 'true']], $list), $inner);
        $prevLabel = $p->lbl('previous_page');
        $nextLabel = $p->lbl('next_page');
        $prevChar = "\u{2039}";
        $nextChar = "\u{203A}";
        $lis = '<li>' . ($model['prev'] === null ? $off([['aria-label', $prevLabel]], $prevChar) : $link($model['prev'], [['rel', 'prev'], ['aria-label', $prevLabel]], $prevChar)) . '</li>';
        foreach ($model['items'] as $it) {
            if ($it === 'ellipsis') {
                $lis .= "<li aria-hidden=\"true\"><span>\u{2026}</span></li>";
            } elseif ($it === $page) {
                $lis .= '<li class="is-active">' . $link($it, [['aria-current', 'page']], (string) $it) . '</li>';
            } else {
                $lis .= '<li>' . $link($it, [], (string) $it) . '</li>';
            }
        }
        $lis .= '<li>' . ($model['next'] === null ? $off([['aria-label', $nextLabel]], $nextChar) : $link($model['next'], [['rel', 'next'], ['aria-label', $nextLabel]], $nextChar)) . '</li>';
        return self::el('nav', [['aria-label', $p->lbl('pagination')]], self::el('ul', [['class', $p->cls(['pagination'])]], $lis));
    }

    /** @return array{0: list<\stdClass>, 1: array<string, string>} */
    private static function splitItems(Props $p, bool $withContent): array
    {
        $raw = $p->src['items'] ?? null;
        if (!Util::isList($raw)) {
            $p->bad('items', 'must be an array');
        }
        $items = [];
        $content = [];
        foreach ($raw as $it) {
            $r = new Props($it, $withContent ? ['id', 'label', 'disabled', 'content', 'contentHtml'] : ['id', 'label', 'disabled']);
            $m = new \stdClass();
            foreach (['id', 'label', 'disabled'] as $k) {
                if ($r->has($k)) {
                    $m->$k = $r->src[$k];
                }
            }
            $items[] = $m;
            if ($withContent) {
                if ($r->has('content') && $r->has('contentHtml')) {
                    $r->bad('content', 'and contentHtml are mutually exclusive');
                }
                $html = $r->has('contentHtml') ? $r->reqText('contentHtml', 1000000) : self::escapeText((string) $r->text('content', '', 100000));
                $content[is_string($r->src['id'] ?? null) ? $r->src['id'] : ''] = $html;
            }
        }
        return [$items, $content];
    }

    /**
     * @param array<string, mixed> $options
     * @return array{0: object, 1: array<string, array<string, string|true>>}
     */
    private static function machineAttrs(string $name, array $options): array
    {
        $c = Machines::get($name);
        try {
            [$ctx, $state] = $c->setup((object) $options);
            return [$ctx, $c->attrs($ctx, $state)];
        } catch (LombokUIError $e) {
            Util::fail('invalid_props', $e->getMessage());
        }
    }

    /**
     * @param list<string> $keys
     * @return array<string, mixed>
     */
    private static function pick(Props $p, array $keys): array
    {
        $o = [];
        foreach ($keys as $k) {
            if ($p->has($k)) {
                $o[$k] = $p->src[$k];
            }
        }
        return $o;
    }

    private static function s(bool $v): string
    {
        return $v ? 'true' : 'false';
    }

    private static function tabs(mixed $props): string
    {
        $keys = ['idBase', 'defaultSelected', 'activation', 'orientation', 'dir', 'loop'];
        $p = new Props($props, array_merge($keys, ['items', 'class']));
        [$items, $content] = self::splitItems($p, true);
        [$ctx, $a] = self::machineAttrs('tabs', self::pick($p, $keys) + ['items' => $items]);
        $list = '';
        $panels = '';
        foreach ($ctx->items as $it) {
            $list .= self::el('button', array_merge([['type', 'button']], self::fromMachine($a["tab:{$it->id}"]), [['data-lui-part', 'tab'], ['data-lui-id', $it->id]]), self::escapeText($it->label));
            $panels .= self::el('div', array_merge([['class', 'tab-panel']], self::fromMachine($a["panel:{$it->id}"]), [['data-lui-part', 'panel'], ['data-lui-id', $it->id]]), $content[$it->id]);
        }
        return self::el('div', [
            ['class', $p->cls(['lui-tabs'])],
            ['data-lui', 'tabs'],
            ['data-lui-base', $ctx->base],
            ['data-activation', $ctx->activation],
            ['data-orientation', $ctx->orientation],
            ['data-dir', $ctx->dir],
            ['data-loop', self::s($ctx->loop)],
        ], self::el('div', array_merge([['class', 'tabs']], self::fromMachine($a['tablist']), [['data-lui-part', 'tablist']]), $list) . $panels);
    }

    private static function accordion(mixed $props): string
    {
        $keys = ['idBase', 'multiple', 'collapsible', 'defaultExpanded', 'orientation', 'dir', 'loop'];
        $p = new Props($props, array_merge($keys, ['items', 'headingLevel', 'class']));
        $level = $p->int('headingLevel', 2, 6, 3);
        [$items, $content] = self::splitItems($p, true);
        [$ctx, $a] = self::machineAttrs('accordion', self::pick($p, $keys) + ['items' => $items]);
        $inner = '';
        foreach ($ctx->items as $it) {
            $button = self::el('button', array_merge([['type', 'button'], ['class', 'accordion-trigger']], self::fromMachine($a["header:{$it->id}"]), [['data-lui-part', 'header'], ['data-lui-id', $it->id]]), self::escapeText($it->label));
            $panel = self::el('div', array_merge([['class', 'accordion-body']], self::fromMachine($a["panel:{$it->id}"]), [['data-lui-part', 'panel'], ['data-lui-id', $it->id]]), $content[$it->id]);
            $inner .= "<div class=\"accordion-item\"><h$level class=\"accordion-heading\">$button</h$level>$panel</div>";
        }
        return self::el('div', [
            ['class', $p->cls(['accordion', 'lui-accordion'])],
            ['data-lui', 'accordion'],
            ['data-lui-base', $ctx->base],
            ['data-multiple', self::s($ctx->multiple)],
            ['data-collapsible', self::s($ctx->collapsible)],
            ['data-orientation', $ctx->orientation],
            ['data-dir', $ctx->dir],
            ['data-loop', self::s($ctx->loop)],
        ], $inner);
    }

    private static function dialog(mixed $props): string
    {
        $keys = ['idBase', 'role', 'modal', 'defaultOpen', 'closeOnEscape', 'closeOnOutsideClick'];
        $p = new Props($props, array_merge($keys, ['title', 'description', 'body', 'bodyHtml', 'closeButton', 'trigger', 'actions', 'class', 'locale', 'labels']));
        $title = $p->reqText('title');
        $description = $p->text('description', null);
        if ($p->has('body') && $p->has('bodyHtml')) {
            $p->bad('body', 'and bodyHtml are mutually exclusive');
        }
        if ($p->has('bodyHtml')) {
            $body = $p->reqText('bodyHtml', 1000000);
        } elseif ($p->has('body')) {
            $body = '<p>' . self::escapeText($p->reqText('body', 100000)) . '</p>';
        } else {
            $body = '';
        }
        [$ctx, $a] = self::machineAttrs('dialog', self::pick($p, $keys) + ['description' => $description !== null]);
        $open = $p->bool('defaultOpen', false);
        $trigger = '';
        if (($p->src['trigger'] ?? null) !== null) {
            $t = new Props($p->src['trigger'], ['label', 'variant']);
            $variant = $t->oneOf('variant', self::VARIANTS, 'primary');
            $trigger = self::el('button', array_merge([['type', 'button'], ['class', "btn btn-$variant"]], self::fromMachine($a['trigger']), [['data-lui-part', 'trigger']]), self::escapeText($t->reqText('label')));
        }
        $header = self::el('h2', array_merge([['class', 'modal-title']], self::fromMachine($a['title']), [['data-lui-part', 'title']]), self::escapeText($title));
        if ($p->bool('closeButton', true)) {
            $header .= self::el('button', [['type', 'button'], ['class', 'btn btn-ghost btn-icon btn-sm'], ['aria-label', $p->lbl('close')], ['data-lui-part', 'close']], self::icon('x'));
        }
        $desc = $description === null ? '' : self::el('p', array_merge(self::fromMachine($a['description']), [['data-lui-part', 'description']]), self::escapeText($description));
        $footer = '';
        if (($p->src['actions'] ?? null) !== null) {
            $acts = $p->src['actions'];
            if (!Util::isList($acts) || count($acts) > 10) {
                $p->bad('actions', 'must be an array of at most 10 actions');
            }
            foreach ($acts as $x) {
                $r = new Props($x, ['label', 'variant', 'value']);
                $footer .= self::el('button', [['type', 'button'], ['class', 'btn btn-' . $r->oneOf('variant', self::VARIANTS, 'ghost')], ['value', $r->text('value', null)], ['data-lui-part', 'close']], self::escapeText($r->reqText('label')));
            }
            $footer = "<div class=\"modal-footer\">$footer</div>";
        }
        $card = "<div class=\"modal-card\"><div class=\"modal-header\">$header</div><div class=\"modal-body\">$desc$body</div>$footer</div>";
        $dlg = self::el('dialog', array_merge([['class', 'modal']], self::fromMachine($a['dialog'], ['hidden']), [['open', $open && !$ctx->modal], ['data-lui-part', 'dialog']]), $card);
        return self::el('div', [
            ['class', $p->cls(['lui-dialog'])],
            ['data-lui', 'dialog'],
            ['data-lui-base', $ctx->base],
            ['data-role', $ctx->role],
            ['data-modal', self::s($ctx->modal)],
            ['data-close-on-escape', self::s($ctx->closeOnEscape)],
            ['data-close-on-outside-click', self::s($ctx->closeOnOutsideClick)],
        ], $trigger . $dlg);
    }

    private static function menu(mixed $props): string
    {
        $keys = ['idBase', 'loop', 'typeaheadTimeout'];
        $p = new Props($props, array_merge($keys, ['label', 'items', 'variant', 'class']));
        $text = $p->reqText('label');
        $variant = $p->oneOf('variant', self::VARIANTS, 'soft');
        [$items] = self::splitItems($p, false);
        [$ctx, $a] = self::machineAttrs('menu', self::pick($p, $keys) + ['items' => $items]);
        $trigger = self::el('button', array_merge([['type', 'button'], ['class', "btn btn-$variant"]], self::fromMachine($a['trigger']), [['data-lui-part', 'trigger']]), '<span>' . self::escapeText($text) . '</span>' . self::icon('chevron-down'));
        $list = '';
        foreach ($ctx->items as $it) {
            $list .= self::el('button', array_merge([['type', 'button'], ['class', 'dropdown-item']], self::fromMachine($a["item:{$it->id}"]), [['data-lui-part', 'item'], ['data-lui-id', $it->id]]), self::escapeText($it->label));
        }
        $m = self::el('div', array_merge([['class', 'dropdown-menu']], self::fromMachine($a['menu']), [['data-lui-part', 'menu']]), $list);
        return self::el('div', [['class', $p->cls(['dropdown'])], ['data-lui', 'menu'], ['data-lui-base', $ctx->base], ['data-loop', self::s($ctx->loop)], ['data-typeahead-timeout', (string) $ctx->timeout]], $trigger . $m);
    }

    /** Renders a component to an HTML string. Text and attribute values are escaped; only contentHtml and bodyHtml are raw. */
    public static function render(mixed $component, mixed $props = null): string
    {
        $props ??= new \stdClass();
        return match ($component) {
            'accordion' => self::accordion($props),
            'alert' => self::alert($props),
            'badge' => self::badge($props),
            'breadcrumb' => self::breadcrumb($props),
            'button' => self::button($props),
            'checkbox' => self::checkbox($props),
            'dialog' => self::dialog($props),
            'field' => self::field($props),
            'menu' => self::menu($props),
            'pagination' => self::pagination($props),
            'progress' => self::progress($props),
            'switch' => self::switchHtml($props),
            'tabs' => self::tabs($props),
            default => Util::fail('invalid_component', 'component "' . (is_string($component) ? $component : '') . '" cannot be rendered'),
        };
    }
}
