<?php

declare(strict_types=1);

namespace Lombok\UI;

/** A pure component: `setup` validates options, `send` is a transition, `attrs` maps state to attributes. */
abstract class Component
{
    public const KEY_FIELDS = ['at' => 'at', 'shift' => 'bool', 'ctrl' => 'bool', 'alt' => 'bool', 'meta' => 'bool'];
    public const KEYDOWN = ['req' => ['key' => 'key'], 'opt' => self::KEY_FIELDS];

    public string $name = '';

    /** @return array{0: object, 1: array<string, mixed>} [ctx, state] */
    abstract public function setup(mixed $options): array;

    /**
     * @param array<string, mixed> $state
     * @return array{0: array<string, mixed>, 1: list<array<string, mixed>>} [state, effects]
     */
    abstract public function send(object $ctx, array $state, mixed $event): array;

    /**
     * @param array<string, mixed> $state
     * @return array<string, array<string, string|true>>
     */
    abstract public function attrs(object $ctx, array $state): array;

    /** @return array<string, array<string, array<string, string>>> */
    abstract protected function events(): array;

    private static function fieldOk(string $kind, mixed $v): bool
    {
        return match ($kind) {
            'id' => is_string($v),
            'key' => is_string($v) && $v !== '' && Util::fitsText($v, 32),
            'at' => Util::isInt($v) && $v >= 0,
            'bool' => is_bool($v),
            'number' => Util::isFinite($v),
            'text' => Util::fitsText($v, Util::MAX_LABEL),
            'check' => $v === true || $v === false || $v === 'mixed',
            'duration' => $v === null || (Util::isInt($v) && $v >= 1 && $v <= Util::MAX_DURATION),
            'kind' => in_array($v, ['info', 'success', 'warning', 'danger'], true),
            default => false,
        };
    }

    /**
     * Validates an event against the component's schema (SPEC 2.3).
     * @return array<string, mixed>
     */
    protected function readEvent(mixed $e): array
    {
        if (!Util::isObject($e) && !($e instanceof \stdClass)) {
            Util::fail('invalid_event', 'event must be an object with a string type');
        }
        $e = Util::props($e);
        if (!isset($e['type']) || !is_string($e['type'])) {
            Util::fail('invalid_event', 'event must be an object with a string type');
        }
        $schema = $this->events();
        if (!array_key_exists($e['type'], $schema)) {
            Util::fail('invalid_event', "unknown event type \"{$e['type']}\"");
        }
        $req = $schema[$e['type']]['req'] ?? [];
        $opt = $schema[$e['type']]['opt'] ?? [];
        $out = ['type' => $e['type']];
        foreach ($e as $k => $v) {
            if ($k === 'type') {
                continue;
            }
            $kind = $req[$k] ?? $opt[$k] ?? null;
            if ($kind === null) {
                Util::fail('invalid_event', "{$e['type']}: unknown field \"$k\"");
            }
            if (!self::fieldOk($kind, $v)) {
                Util::fail('invalid_event', "{$e['type']}.$k is invalid");
            }
            if (($kind === 'at' || $kind === 'duration') && $v !== null) {
                $v = (int) $v;
            } elseif ($kind === 'number') {
                $v = (float) $v;
            }
            $out[$k] = $v;
        }
        foreach (array_keys($req) as $k) {
            if (!array_key_exists($k, $e)) {
                Util::fail('invalid_event', "{$e['type']}.$k is required");
            }
        }
        return $out;
    }

    /** @param array<string, mixed> $e */
    protected static function hasModifier(array $e): bool
    {
        return ($e['ctrl'] ?? null) === true || ($e['alt'] ?? null) === true || ($e['meta'] ?? null) === true;
    }

    /** @return array<string, mixed> */
    protected static function change(string $name, mixed $value): array
    {
        return ['type' => 'change', 'name' => $name, 'value' => $value];
    }

    /** @return array<string, string> */
    protected static function focus(string $target): array
    {
        return ['type' => 'focus', 'target' => $target];
    }

    protected static function stateAttr(bool $open): string
    {
        return $open ? 'open' : 'closed';
    }

    /** @param list<Item> $items */
    protected static function item(array $items, mixed $id, string $ev): Item
    {
        $it = Util::findItem($items, $id);
        if ($it === null) {
            Util::fail('invalid_event', "$ev: unknown item \"" . (is_string($id) ? $id : '') . '"');
        }
        return $it;
    }

    /**
     * @param list<Item> $items
     * @return list<string>
     */
    protected static function readIdList(Reader $r, string $key, array $items): array
    {
        if (!$r->has($key)) {
            return [];
        }
        $v = $r->src[$key];
        if (!Util::isList($v)) {
            $r->bad($key, 'must be an array of item ids');
        }
        $seen = [];
        foreach ($v as $x) {
            if (Util::findItem($items, $x) === null || isset($seen[$x])) {
                $r->bad($key, 'must list existing item ids without duplicates');
            }
            $seen[$x] = true;
        }
        return Util::ordered($items, $seen);
    }
}

/** Component registry and the contract entry points `run` and `attrs` (SPEC 4). */
final class Machines
{
    /** @var array<string, Component> */
    private static array $registry = [];

    public static function register(Component $c): void
    {
        self::$registry[$c->name] = $c;
    }

    public static function get(mixed $name): Component
    {
        $c = is_string($name) ? (self::$registry[$name] ?? null) : null;
        if ($c === null) {
            Util::fail('invalid_component', 'unknown component "' . (is_string($name) ? $name : '') . '"');
        }
        return $c;
    }

    /** @return list<string> */
    public static function names(): array
    {
        $n = array_keys(self::$registry);
        sort($n);
        return $n;
    }

    /** @return array{initial: array<string, mixed>, steps: list<array<string, mixed>>} */
    public static function run(mixed $component, mixed $options, mixed $events): array
    {
        $c = self::get($component);
        if (!Util::isList($events)) {
            Util::fail('invalid_event', 'events must be an array');
        }
        [$ctx, $state] = $c->setup($options);
        $initial = $state;
        $steps = [];
        foreach ($events as $e) {
            try {
                [$state, $effects] = $c->send($ctx, $state, $e);
                $steps[] = ['state' => $state, 'effects' => $effects];
            } catch (LombokUIError $err) {
                $steps[] = ['$error' => $err->errorCode];
            }
        }
        return ['initial' => $initial, 'steps' => $steps];
    }

    /** @return array<string, array<string, string|true>> */
    public static function attrsAfter(mixed $component, mixed $options, mixed $events = []): array
    {
        $c = self::get($component);
        if (!Util::isList($events)) {
            Util::fail('invalid_event', 'events must be an array');
        }
        [$ctx, $state] = $c->setup($options);
        foreach ($events as $e) {
            [$state] = $c->send($ctx, $state, $e);
        }
        return $c->attrs($ctx, $state);
    }
}

/** A stateful convenience wrapper around a pure component. */
final class Machine
{
    public readonly Component $component;
    public readonly object $ctx;
    /** @var array<string, mixed> */
    private array $current;
    /** @var list<callable> */
    private array $listeners = [];

    public function __construct(string $component, mixed $options = null)
    {
        $this->component = Machines::get($component);
        [$this->ctx, $this->current] = $this->component->setup($options ?? new \stdClass());
    }

    /** @return array<string, mixed> */
    public function state(): array
    {
        return $this->current;
    }

    /**
     * @param array<string, mixed>|\stdClass $event
     * @return list<array<string, mixed>>
     */
    public function send(array|\stdClass $event): array
    {
        [$this->current, $effects] = $this->component->send($this->ctx, $this->current, $event);
        foreach ($this->listeners as $fn) {
            $fn($this->current, $effects);
        }
        return $effects;
    }

    /** @return array<string, array<string, string|true>> */
    public function attrs(): array
    {
        return $this->component->attrs($this->ctx, $this->current);
    }

    public function subscribe(callable $fn): void
    {
        $this->listeners[] = $fn;
    }
}
