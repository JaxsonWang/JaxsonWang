var obj = JSON.parse($response.body);

obj.merchandises = [
    {
        "sku_key": "vip_pro",
        "expire_time": 2693905525,
        "effect_time": 1712919925,
        "name": "WPS超级会员基础套餐",
        "type": "vip"
    },
    {
        "sku_key": "ai_kdocs_solution_airpage",
        "expire_time": 2693905525,
        "effect_time": 1713498162,
        "name": "AI金山文档AirPage模板",
        "type": "privilege"
    }
]

$done({ body: JSON.stringify(obj) });
