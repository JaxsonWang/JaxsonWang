var obj = JSON.parse($response.body);

obj.vipinfo = {
    "expire_time": 2693905525,
    "memberid": 40,
    "name": "超级会员",
    "has_ad": 0,
    "enabled": [
        {
            "name": "超级会员",
            "expire_time": 2693905525,
            "memberid": 40
        },
        {
            "name": "WPS会员",
            "expire_time": 2693905525,
            "memberid": 20
        },
        {
            "name": "稻壳会员",
            "expire_time": 2693905525,
            "memberid": 12
        }
    ]
}

$done({ body: JSON.stringify(obj) });
