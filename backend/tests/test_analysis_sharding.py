from backend.analysis.sharding import normalize_shard_args, select_shard


def test_select_shard_partitions_without_overlap():
    symbols = ["000001", "000002", "000003", "000004", "000005", "000006", "000007"]

    shards = [select_shard(symbols, shard_index=i, shard_total=3) for i in range(3)]
    flattened = [symbol for shard in shards for symbol in shard]

    assert sorted(flattened) == sorted(symbols)
    assert len(flattened) == len(set(flattened))
    assert shards[0] == ["000001", "000004", "000007"]
    assert shards[1] == ["000002", "000005"]
    assert shards[2] == ["000003", "000006"]


def test_select_shard_single_shard_returns_all_items():
    symbols = ["AAPL", "MSFT"]

    assert select_shard(symbols, shard_index=0, shard_total=1) == symbols


def test_normalize_shard_args_clamps_invalid_values():
    assert normalize_shard_args(shard_index=-1, shard_total=0) == (0, 1)
    assert normalize_shard_args(shard_index=5, shard_total=4) == (1, 4)
