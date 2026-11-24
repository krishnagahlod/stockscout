from app.services.scoring_service import calculate_momentum_score


def test_momentum_uses_real_price():
    near_high = calculate_momentum_score({"week_52_high": 100, "price": 95, "beta": 2.0})
    far_below = calculate_momentum_score({"week_52_high": 100, "price": 50, "beta": 2.0})
    no_price = calculate_momentum_score({"week_52_high": 100, "beta": 2.0})
    assert near_high > no_price > far_below
