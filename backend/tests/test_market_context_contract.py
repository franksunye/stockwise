import types
import unittest

import pandas as pd

import backend.context.provider as provider_module
from backend.context.provider import MarketContextProvider


class TestMarketContextContract(unittest.TestCase):
    def setUp(self):
        self.provider = MarketContextProvider()
        self.provider._cache["macro"] = {"data": None, "timestamp": None}
        self.provider._cache["market_flow"] = {"data": None, "timestamp": None}

    def test_market_flow_contract_and_outflow_filter(self):
        # Use unicode escapes to avoid local file encoding issues.
        col_dir = "\u8d44\u91d1\u65b9\u5411"  # 资金方向
        col_up = "\u4e0a\u6da8\u6570"  # 上涨数
        col_down = "\u4e0b\u8dcc\u6570"  # 下跌数
        col_flat = "\u6301\u5e73\u6570"  # 持平数
        col_name = "\u540d\u79f0"  # 名称
        col_net = "\u4eca\u65e5\u4e3b\u529b\u51c0\u6d41\u5165-\u51c0\u989d"  # 今日主力净流入-净额

        df_north = pd.DataFrame(
            [
                {
                    col_dir: "\u5317\u5411",  # 北向
                    col_up: 30,
                    col_down: 10,
                    col_flat: 5,
                }
            ]
        )
        df_sector = pd.DataFrame(
            [
                {col_name: "AI", col_net: 8e8},
                {col_name: "\u7b97\u529b", col_net: 3e8},
                {col_name: "\u8f6f\u4ef6", col_net: 1e8},
                {col_name: "\u533b\u836f", col_net: -2e8},
                {col_name: "\u767d\u9152", col_net: -5e8},
            ]
        )

        def fake_fetch(_, func, *args, **kwargs):
            if func is provider_module.ak.stock_hsgt_fund_flow_summary_em:
                return df_north
            if func is provider_module.ak.stock_sector_fund_flow_rank:
                return df_sector
            raise AssertionError(f"Unexpected fetch function: {func}")

        self.provider._safe_ak_fetch = types.MethodType(fake_fetch, self.provider)
        data = self.provider.get_market_flow_context()

        self.assertEqual(data.get("contract_version"), "market_flow.v1")
        self.assertIn("quality", data)
        self.assertIn("fields", data)
        self.assertIn("top_outflow_sectors", data)
        self.assertNotIn("+", data["top_outflow_sectors"])
        self.assertTrue(("-" in data["top_outflow_sectors"]) or (">=0" in data["top_outflow_sectors"]))

    def test_macro_contract_presence(self):
        def fake_fetch(_, func, *args, **kwargs):
            return pd.DataFrame()

        self.provider._safe_ak_fetch = types.MethodType(fake_fetch, self.provider)
        data = self.provider.get_macro_context(skip_nasdaq=True)

        self.assertEqual(data.get("contract_version"), "macro.v1")
        self.assertIn("quality", data)
        self.assertIn("fields", data)
        self.assertIn("nasdaq", data)
        self.assertTrue(data.get("nasdaq_skipped"))


if __name__ == "__main__":
    unittest.main()
