var obj = JSON.parse($response.body);

var id = obj.userid;

obj = {
    exp: 0,
    level: 3,
    privilege: [
        { spid: "data_recover", times: 0, expire_time: 4093069309 },
        { spid: "ocr", times: 0, expire_time: 4093069309 },
        { spid: "pdf2doc", times: 0, expire_time: 4093069309 },
        { spid: "pdf_merge", times: 0, expire_time: 4093069309 },
        { spid: "pdf_sign", times: 0, expire_time: 4093069309 },
        { spid: "pdf_split", times: 0, expire_time: 4093069309 }
    ],
    result: "ok",
    total_buy: 0,
    total_cost: -30,
    userid: '0000',
    vip: {
        name: "超级会员",
        has_ad: 0,
        memberid: 40,
        expire_time: 4093069309,
        enabled: [
            { memberid: 40, name: "超级会员", expire_time: 4093069309 },
            { memberid: 20, name: "WPS会员", expire_time: 4093069309 },
            { memberid: 12, name: "稻壳会员", expire_time: 4093069309 }
        ]
    },
    wealth: 0,
    expire_time: 4093069309
};

obj.userid = id;

$done({ body: JSON.stringify(obj) });
