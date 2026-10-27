<?php

declare(strict_types=1);

namespace Lombok\UI;

/** The only exception thrown by LombokUI. `errorCode` is the cross-language contract (SPEC 11). */
final class LombokUIError extends \RuntimeException
{
    public readonly string $errorCode;
    public readonly string $messageId;

    public function __construct(string $code, string $message)
    {
        parent::__construct($message);
        $this->errorCode = $code;
        $this->messageId = 'lombokui.error.' . $code;
    }
}

/** Validation, keyboard navigation, typeahead and number formatting (SPEC 2 and 3). */
final class Util
{
    public const MAX_INT = 9007199254740991;
    public const MAX_ITEMS = 1000;
    public const MAX_LABEL = 1000;
    public const MAX_DURATION = 2147483647;
    public const ERROR_CODES = ['invalid_component', 'invalid_option', 'invalid_event', 'invalid_props'];

    public static function fail(string $code, string $message): never
    {
        throw new LombokUIError($code, $message);
    }

    /** A JSON object: stdClass, or an associative (non-list) PHP array. */
    public static function isObject(mixed $v): bool
    {
        return $v instanceof \stdClass || (is_array($v) && $v !== [] && !array_is_list($v));
    }

    public static function isList(mixed $v): bool
    {
        return is_array($v) && array_is_list($v);
    }

    /** @return array<string, mixed> */
    public static function props(mixed $v): array
    {
        $out = [];
        foreach ((array) $v as $k => $x) {
            $out[(string) $k] = $x;
        }
        return $out;
    }

    public static function isNumber(mixed $v): bool
    {
        return is_int($v) || is_float($v);
    }

    public static function isFinite(mixed $v): bool
    {
        return is_int($v) || (is_float($v) && is_finite($v));
    }

    public static function isInt(mixed $v): bool
    {
        if (is_int($v)) {
            return abs($v) <= self::MAX_INT;
        }
        return is_float($v) && is_finite($v) && floor($v) === $v && abs($v) <= self::MAX_INT;
    }

    public static function isId(mixed $v): bool
    {
        return is_string($v) && preg_match('/\A[A-Za-z][A-Za-z0-9_-]{0,63}\z/', $v) === 1;
    }

    /** Strings are measured in code points (SPEC 2.1). */
    public static function cpLen(string $s): int
    {
        return mb_strlen($s, 'UTF-8');
    }

    public static function fitsText(mixed $v, int $limit): bool
    {
        return is_string($v) && (strlen($v) <= $limit || self::cpLen($v) <= $limit);
    }

    public static function trimAscii(string $s): string
    {
        return trim($s, " \t\n\f\r");
    }

    public static function boolAttr(bool $v): string
    {
        return $v ? 'true' : 'false';
    }

    /** ASCII-only lowercase (SPEC 3.3). */
    public static function fold(string $s): string
    {
        return strtr($s, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz');
    }

    public static function isCharKey(string $key): bool
    {
        if (self::cpLen($key) !== 1) {
            return false;
        }
        $cp = mb_ord($key, 'UTF-8');
        return $cp !== false && $cp > 0x20 && $cp !== 0x7F && !($cp >= 0x80 && $cp <= 0x9F);
    }

    /** @param list<Item> $items */
    public static function indexOf(array $items, ?string $id): int
    {
        if ($id === null) {
            return -1;
        }
        foreach ($items as $i => $it) {
            if ($it->id === $id) {
                return $i;
            }
        }
        return -1;
    }

    /** @param list<Item> $items */
    public static function findItem(array $items, mixed $id): ?Item
    {
        if (!is_string($id)) {
            return null;
        }
        $i = self::indexOf($items, $id);
        return $i < 0 ? null : $items[$i];
    }

    /**
     * Ids from $items that are keys of $set, in item order.
     * @param list<Item> $items
     * @param array<string, true> $set
     * @return list<string>
     */
    public static function ordered(array $items, array $set): array
    {
        $out = [];
        foreach ($items as $it) {
            if (isset($set[$it->id])) {
                $out[] = $it->id;
            }
        }
        return $out;
    }

    /** @param list<Item> $items */
    public static function firstEnabled(array $items): ?string
    {
        foreach ($items as $it) {
            if (!$it->disabled) {
                return $it->id;
            }
        }
        return null;
    }

    /** Maps a UI Events `key` to a move (SPEC 3.1). */
    public static function keyMove(string $key, string $orientation, string $dir): ?string
    {
        if ($key === 'Home') {
            return 'first';
        }
        if ($key === 'End') {
            return 'last';
        }
        $vertical = $orientation === 'vertical' || $orientation === 'both';
        $horizontal = $orientation === 'horizontal' || $orientation === 'both';
        if ($vertical && $key === 'ArrowDown') {
            return 'next';
        }
        if ($vertical && $key === 'ArrowUp') {
            return 'prev';
        }
        if ($horizontal && $key === 'ArrowRight') {
            return $dir === 'rtl' ? 'prev' : 'next';
        }
        if ($horizontal && $key === 'ArrowLeft') {
            return $dir === 'rtl' ? 'next' : 'prev';
        }
        return null;
    }

    /**
     * Moves among enabled items (SPEC 3.2). Returns $current when nothing qualifies.
     * @param list<Item> $items
     */
    public static function navigate(array $items, ?string $current, string $move, bool $loop): ?string
    {
        $n = count($items);
        if ($move === 'first') {
            foreach ($items as $it) {
                if (!$it->disabled) {
                    return $it->id;
                }
            }
            return $current;
        }
        if ($move === 'last') {
            for ($i = $n - 1; $i >= 0; $i--) {
                if (!$items[$i]->disabled) {
                    return $items[$i]->id;
                }
            }
            return $current;
        }
        $ci = self::indexOf($items, $current);
        if ($move === 'next') {
            for ($i = $ci + 1; $i < $n; $i++) {
                if (!$items[$i]->disabled) {
                    return $items[$i]->id;
                }
            }
            if ($loop) {
                for ($i = 0; $i < $ci; $i++) {
                    if (!$items[$i]->disabled) {
                        return $items[$i]->id;
                    }
                }
            }
            return $current;
        }
        $start = $ci < 0 ? $n : $ci;
        for ($i = $start - 1; $i >= 0; $i--) {
            if (!$items[$i]->disabled) {
                return $items[$i]->id;
            }
        }
        if ($loop) {
            for ($i = $n - 1; $i > $start; $i--) {
                if (!$items[$i]->disabled) {
                    return $items[$i]->id;
                }
            }
        }
        return $current;
    }

    /**
     * Typeahead (SPEC 3.3). Returns [query, queryAt, match].
     * @param list<Item> $items
     * @return array{0: string, 1: int, 2: ?string}
     */
    public static function typeahead(array $items, ?string $current, string $query, ?int $queryAt, string $ch, int $at, int $timeout): array
    {
        $cont = $queryAt !== null && $at >= $queryAt && $at - $queryAt < $timeout;
        $raw = $cont ? $query . $ch : $ch;
        $q = self::fold($raw);
        $cps = mb_str_split($q, 1, 'UTF-8');
        $repeated = true;
        foreach ($cps as $c) {
            if ($c !== $cps[0]) {
                $repeated = false;
                break;
            }
        }
        $needle = $repeated ? $cps[0] : $q;
        $ci = self::indexOf($items, $current);
        $n = count($items);
        $start = $repeated ? $ci + 1 : max($ci, 0);
        $match = null;
        for ($k = 0; $k < $n; $k++) {
            $it = $items[($start + $k) % $n];
            if (!$it->disabled && str_starts_with(self::fold($it->label), $needle)) {
                $match = $it->id;
                break;
            }
        }
        return [$raw, $at, $match];
    }

    /** Formats a number for an attribute value (SPEC 2.5). */
    public static function formatNumber(int|float $v, int $decimals): string
    {
        $s = sprintf('%.' . $decimals . 'F', (float) $v);
        if (str_contains($s, '.')) {
            $s = rtrim(rtrim($s, '0'), '.');
        }
        return $s === '-0' ? '0' : $s;
    }

    /** Decimal digits in the shortest round-trip representation of $v. */
    public static function decimalsOf(int|float $v): int
    {
        $f = abs((float) $v);
        if (floor($f) === $f) {
            return 0;
        }
        $s = strtolower((string) json_encode($f, JSON_PRESERVE_ZERO_FRACTION));
        $exp = 0;
        $e = strpos($s, 'e');
        if ($e !== false) {
            $exp = (int) substr($s, $e + 1);
            $s = substr($s, 0, $e);
        }
        $dot = strpos($s, '.');
        $frac = $dot === false ? '' : rtrim(substr($s, $dot + 1), '0');
        return max(0, strlen($frac) - $exp);
    }
}

/** An item of a list option (SPEC 2.2). */
final class Item
{
    public function __construct(public readonly string $id, public readonly string $label, public readonly bool $disabled)
    {
    }

    /** @return list<Item> */
    public static function readList(mixed $v, string $code, string $what = 'items', int $minimum = 1): array
    {
        if (!Util::isList($v) || count($v) < $minimum || count($v) > Util::MAX_ITEMS) {
            Util::fail($code, "$what must be an array of $minimum.." . Util::MAX_ITEMS . ' items');
        }
        $seen = [];
        $out = [];
        foreach ($v as $i => $raw) {
            $r = new Reader($raw, $code, "{$what}[$i]", ['id', 'label', 'disabled']);
            $id = $r->id('id', null);
            if ($id === null) {
                $r->bad('id', 'is required');
            }
            if (isset($seen[$id])) {
                $r->bad('id', "duplicates \"$id\"");
            }
            $seen[$id] = true;
            $out[] = new Item($id, $r->text('label', $id), $r->bool('disabled', false));
        }
        return $out;
    }
}

/** Reads an options/props object strictly: unknown keys are an error. */
class Reader
{
    /** @var array<string, mixed> */
    public array $src;

    /** @param list<string> $allowed */
    public function __construct(mixed $src, public readonly string $code, public readonly string $what, array $allowed)
    {
        if (!Util::isObject($src) && !($src instanceof \stdClass)) {
            Util::fail($code, "$what must be an object");
        }
        $this->src = Util::props($src);
        foreach (array_keys($this->src) as $k) {
            if (!in_array($k, $allowed, true)) {
                Util::fail($code, "$what: unknown key \"$k\"");
            }
        }
    }

    public function has(string $key): bool
    {
        return array_key_exists($key, $this->src);
    }

    public function raw(string $key): mixed
    {
        return $this->src[$key] ?? null;
    }

    public function bad(string $key, string $why): never
    {
        Util::fail($this->code, "{$this->what}.$key $why");
    }

    public function bool(string $key, bool $default): bool
    {
        if (!$this->has($key)) {
            return $default;
        }
        $v = $this->src[$key];
        if (!is_bool($v)) {
            $this->bad($key, 'must be a boolean');
        }
        return $v;
    }

    /** @param list<string> $values */
    public function oneOf(string $key, array $values, string $default): string
    {
        if (!$this->has($key)) {
            return $default;
        }
        $v = $this->src[$key];
        if (!is_string($v) || !in_array($v, $values, true)) {
            $this->bad($key, 'must be one of ' . implode(', ', $values));
        }
        return $v;
    }

    public function int(string $key, int $lo, int $hi, int $default): int
    {
        if (!$this->has($key)) {
            return $default;
        }
        $v = $this->src[$key];
        if (!Util::isInt($v) || $v < $lo || $v > $hi) {
            $this->bad($key, "must be an integer in $lo..$hi");
        }
        return (int) $v;
    }

    public function num(string $key, float $default): float
    {
        if (!$this->has($key)) {
            return $default;
        }
        $v = $this->src[$key];
        if (!Util::isFinite($v)) {
            $this->bad($key, 'must be a finite number');
        }
        return (float) $v;
    }

    public function text(string $key, ?string $default, int $limit = Util::MAX_LABEL): ?string
    {
        $v = $this->src[$key] ?? null;
        if ($v === null) {
            return $default;
        }
        if (!Util::fitsText($v, $limit)) {
            $this->bad($key, "must be a string of at most $limit characters");
        }
        return $v;
    }

    public function reqText(string $key, int $limit = Util::MAX_LABEL): string
    {
        $v = $this->src[$key] ?? null;
        if (!Util::fitsText($v, $limit)) {
            $this->bad($key, "must be a string of at most $limit characters");
        }
        return $v;
    }

    public function id(string $key, ?string $default): ?string
    {
        $v = $this->src[$key] ?? null;
        if ($v === null) {
            return $default;
        }
        if (!Util::isId($v)) {
            $this->bad($key, 'must be an id ([A-Za-z][A-Za-z0-9_-]{0,63})');
        }
        return $v;
    }

    public function idBase(): string
    {
        return (string) $this->id('idBase', 'lui');
    }
}
