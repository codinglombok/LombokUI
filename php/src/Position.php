<?php

declare(strict_types=1);

namespace Lombok\UI;

/** Floating-element positioning (SPEC 6) and the page list model (SPEC 7). */
final class Layout
{
    public const PLACEMENTS = [
        'top', 'top-start', 'top-end', 'bottom', 'bottom-start', 'bottom-end',
        'left', 'left-start', 'left-end', 'right', 'right-start', 'right-end',
    ];
    private const OPPOSITE = ['top' => 'bottom', 'bottom' => 'top', 'left' => 'right', 'right' => 'left'];
    public const MAX_PAGES = 2147483647;

    /** @return array{x: float, y: float, width: float, height: float} */
    private static function rect(mixed $v, string $key, bool $size = false): array
    {
        $keys = $size ? ['width', 'height'] : ['x', 'y', 'width', 'height'];
        $r = new Reader($v, 'invalid_option', $key, $keys);
        foreach ($keys as $k) {
            if (!Util::isFinite($r->raw($k))) {
                $r->bad($k, 'must be a finite number');
            }
        }
        $w = (float) $r->raw('width');
        $h = (float) $r->raw('height');
        if ($w < 0 || $h < 0) {
            $r->bad('width', 'and height must not be negative');
        }
        return ['x' => $size ? 0.0 : (float) $r->raw('x'), 'y' => $size ? 0.0 : (float) $r->raw('y'), 'width' => $w, 'height' => $h];
    }

    /** @return array<string, mixed> */
    public static function position(mixed $args): array
    {
        $r = new Reader($args, 'invalid_option', 'position', ['reference', 'floating', 'placement', 'offset', 'flip', 'shift', 'padding', 'boundary', 'arrow', 'arrowPadding', 'dir']);
        $ref = self::rect($r->raw('reference'), 'reference');
        $fl = self::rect($r->raw('floating'), 'floating', true);
        $placement = $r->oneOf('placement', self::PLACEMENTS, 'bottom');
        $offset = $r->num('offset', 0);
        $flip = $r->bool('flip', true);
        $shift = $r->bool('shift', true);
        $padding = $r->num('padding', 0);
        $boundary = $r->raw('boundary') === null ? null : self::rect($r->raw('boundary'), 'boundary');
        $arrowSize = $r->raw('arrow') === null ? null : $r->num('arrow', 0);
        if ($arrowSize !== null && $arrowSize < 0) {
            $r->bad('arrow', 'must not be negative');
        }
        $arrowPadding = $r->num('arrowPadding', 0);
        $dir = $r->oneOf('dir', ['ltr', 'rtl'], 'ltr');

        $parts = explode('-', $placement);
        $side = $parts[0];
        $align = $parts[1] ?? 'center';

        $coords = function (string $s) use ($ref, $fl, $offset, $align, $dir): array {
            if ($s === 'top' || $s === 'bottom') {
                $y = $s === 'top' ? $ref['y'] - $fl['height'] - $offset : $ref['y'] + $ref['height'] + $offset;
                $a = $align;
                if ($align !== 'center' && $dir === 'rtl') {
                    $a = $align === 'start' ? 'end' : 'start';
                }
                $x = match ($a) {
                    'start' => $ref['x'],
                    'end' => $ref['x'] + $ref['width'] - $fl['width'],
                    default => $ref['x'] + $ref['width'] / 2 - $fl['width'] / 2,
                };
            } else {
                $x = $s === 'left' ? $ref['x'] - $fl['width'] - $offset : $ref['x'] + $ref['width'] + $offset;
                $y = match ($align) {
                    'start' => $ref['y'],
                    'end' => $ref['y'] + $ref['height'] - $fl['height'],
                    default => $ref['y'] + $ref['height'] / 2 - $fl['height'] / 2,
                };
            }
            return [$x, $y];
        };
        $overflow = function (string $s, array $p, array $b) use ($fl, $padding): float {
            return match ($s) {
                'top' => $b['y'] + $padding - $p[1],
                'bottom' => $p[1] + $fl['height'] - ($b['y'] + $b['height'] - $padding),
                'left' => $b['x'] + $padding - $p[0],
                default => $p[0] + $fl['width'] - ($b['x'] + $b['width'] - $padding),
            };
        };

        $p = $coords($side);
        if ($flip && $boundary !== null) {
            $o1 = $overflow($side, $p, $boundary);
            if ($o1 > 0) {
                $opp = self::OPPOSITE[$side];
                $q = $coords($opp);
                if ($overflow($opp, $q, $boundary) < $o1) {
                    $side = $opp;
                    $p = $q;
                }
            }
        }
        if ($shift && $boundary !== null) {
            if ($side === 'top' || $side === 'bottom') {
                $lo = $boundary['x'] + $padding;
                $hi = $boundary['x'] + $boundary['width'] - $padding - $fl['width'];
                $p = [max($lo, min($p[0], $hi)), $p[1]];
            } else {
                $lo = $boundary['y'] + $padding;
                $hi = $boundary['y'] + $boundary['height'] - $padding - $fl['height'];
                $p = [$p[0], max($lo, min($p[1], $hi))];
            }
        }
        $arrow = null;
        if ($arrowSize !== null) {
            $vertical = $side === 'top' || $side === 'bottom';
            $raw = $vertical ? $ref['x'] + $ref['width'] / 2 - $p[0] - $arrowSize / 2 : $ref['y'] + $ref['height'] / 2 - $p[1] - $arrowSize / 2;
            $hi = ($vertical ? $fl['width'] : $fl['height']) - $arrowPadding - $arrowSize;
            $arrow = ['edge' => self::OPPOSITE[$side], 'offset' => max($arrowPadding, min($raw, $hi))];
        }
        return ['x' => $p[0], 'y' => $p[1], 'placement' => $align === 'center' ? $side : "$side-$align", 'side' => $side, 'align' => $align, 'arrow' => $arrow];
    }

    /** @return list<int> */
    private static function range(int $a, int $b): array
    {
        return $a > $b ? [] : range($a, $b);
    }

    /** @return array{items: list<int|string>, prev: ?int, next: ?int} */
    public static function pagination(mixed $args): array
    {
        $r = new Reader($args, 'invalid_option', 'pagination', ['page', 'total', 'siblings', 'boundaries']);
        $total = $r->int('total', 1, self::MAX_PAGES, 1);
        if (!$r->has('total')) {
            $r->bad('total', 'is required');
        }
        $page = $r->int('page', 1, $total, 1);
        $s = $r->int('siblings', 0, 10, 1);
        $b = $r->int('boundaries', 0, 10, 1);

        $startPages = self::range(1, min($b, $total));
        $endPages = self::range(max($total - $b + 1, $b + 1), $total);
        $sibStart = max(min($page - $s, $total - $b - $s * 2 - 1), $b + 2);
        $sibEnd = min(max($page + $s, $b + $s * 2 + 2), $endPages !== [] ? $endPages[0] - 2 : $total - 1);

        $items = $startPages;
        if ($sibStart > $b + 2) {
            $items[] = 'ellipsis';
        } elseif ($b + 1 < $total - $b) {
            $items[] = $b + 1;
        }
        array_push($items, ...self::range($sibStart, $sibEnd));
        if ($sibEnd < $total - $b - 1) {
            $items[] = 'ellipsis';
        } elseif ($total - $b > $b) {
            $items[] = $total - $b;
        }
        array_push($items, ...$endPages);
        return ['items' => $items, 'prev' => $page > 1 ? $page - 1 : null, 'next' => $page < $total ? $page + 1 : null];
    }
}
