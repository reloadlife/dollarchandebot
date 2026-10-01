<?php

namespace WHMCS\Database;

class Capsule {
    public static array $rates = [
        5 => ["id" => 5, "code" => "IRT", "default" => 0, "rate" => "1.00000000"],
    ];
    public static int $updates = 0;

    public static function table(string $name): Query {
        return new Query($name);
    }

    public static function statement(string $sql): void {}

    public static function schema(): Schema {
        return new Schema();
    }
}

class Schema {
    public function hasTable(string $name): bool {
        return true;
    }

    public function create(string $name, $callback): void {}
}

class Query {
    private int $id = 0;

    public function __construct(private string $table) {}

    public function where(string $column, $value): self {
        $this->id = (int) $value;
        return $this;
    }

    public function orderBy(string $column, string $direction = "asc"): self {
        return $this;
    }

    public function get($columns = null): array {
        return [];
    }

    public function insert(array $row): void {}

    public function first(): ?object {
        if ($this->table !== "tblcurrencies") {
            return null;
        }
        $row = Capsule::$rates[$this->id] ?? null;
        return $row ? (object) $row : null;
    }

    public function update(array $data): void {
        if ($this->table !== "tblcurrencies" || !isset(Capsule::$rates[$this->id])) {
            return;
        }
        Capsule::$updates++;
        Capsule::$rates[$this->id]["rate"] = (string) $data["rate"];
    }

    public function value(string $column) {
        return Capsule::$rates[$this->id][$column] ?? null;
    }
}
