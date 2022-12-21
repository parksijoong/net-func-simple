const chromium = require('chrome-aws-lambda');
const puppeteer = require('puppeteer-core');
const CarSpec = require('./CarSpec.json')  //


const calculateDays = (str) => {
    // console.log('days',str)
    if (str === "日帰り") {
        return 1;
    } else {
        // console.log(str.match(/\d{1,2}/g))
        return parseInt((str.match(/\d{1,2}/g))[1])
    }
}


const transDays = (str, lang = 'ko') => {
    if (str == "日帰り") return '하루'
    return str.match(/\d{1,2}/g).join('박') + '일'
}



const Translate_CarType = (num) => {
    if (num === 1) {
        return "하이브리드"
    } else if (num == 2) {
        return "경차"
    } else if (num == 3) {
        return "소형"
    } else if (num == 4) {
        return "중대형"
    } else if (num == 5) {
        return "밴"
    } else {
        return null
    }
}

const r_Translate_CarType = (str) => {
    if (str === "하이브리드") {
        return 1
    } else if (str === "경차") {
        return 2
    } else if (str === "소형") {
        return 3
    } else if (str === "중대형") {
        return 4
    } else if (str === "밴") {
        return 5
    } else {
        return null
    }
}

const Translate_ClassName = (str, lang) => {
    // str.normalize('NFKC');
    const a = CarSpec.find(a => str.match(a.ja));
    if (a == undefined) {
        return ''
    } else {
        return a[lang];
    }
}

const preChargeCalc = (obj) => {
    const days = calculateDays(obj.UseDayOrTime);
    // console.log('carType',typeof(obj.CarType));
    // console.log(days)
    if (obj.SupplierID == 47) return 2500 * days;
    if (obj.CarType == 5) return 2000 * days;
    if (obj.CarType == 4) return 1500 * days;
    if (obj.CarType < 4) return 1500 * days;
}

const get_carrier = (str) => {
    const a = CarSpec.find(a => a.ko == str);
    if (a == undefined) {
        return 0
    } else {
        return a.carrier;
    }
}
const get_cc = (str) => {
    const a = CarSpec.find(a => a.ko == str);
    if (a == undefined) {
        return 0
    } else {
        return a.cc;
    }
}


exports.handler = async function (event, context) {
    let req = {}
    req.query = event.queryStringParameters;
    const url = `https://www.tabirai.net/car/okinawa/search/rentacar.aspx?`
        + `SYF=${req.query.fromDay}&` //시작일
        + `SYT=${req.query.returnDay}&`   //반환일
        + `SYFT=${encodeURIComponent(req.query.fromTime)}&` //대여시간
        + `SYTT=${encodeURIComponent(req.query.returnTime)}&` //반환시간
        + `SAFG=3&` //
        + `SATG=3&` //
        + `SAF=${req.query.SEARCH_AREA}&`
        + `SAT=${req.query.TO_AREA}&`
        + `STP=${req.query.carType}&` //자동차타입
        + `SSM=${req.query.KINEN}&` //금연흡연 0,1,2
        + `SPT=147&`  //몰라
        + `SPF=147&`  //몰라
        + `SSP=&`  //몰라
        + `PRV=0&` //몰라
        + `SRT=0&` //몰라
        + `PID=` //몰라

    const browser = await puppeteer.launch({
        args: chromium.args,
        executablePath: process.env.CHROME_EXECUTABLE_PATH || await chromium.executablePath,
        headless: true,
    });

    const page = await browser.newPage();

    await page.goto(url, { waitUntil: 'networkidle0' });


    const jsondata = await page.evaluate(() => document.querySelector('#hdnJsonResult').attributes.value)
    const RentFirmFilterddResult = jsondata.SearchResults.filter(a => a.SupplierID == 7 || a.SupplierID == 8 || a.SupplierID == 11 || a.SupplierID == 47 || a.SupplierID == 19)
    const pricesResult = RentFirmFilterddResult.map(a => {  //가격정리
        a.price = {};
        a.SupplierName = '';
        if (a.ReturnPoint == 147114 || a.DeparturePoint == 147114) {
            a.price.dropCharge = 2200;
        } else {
            a.price.dropCharge = 0
        }
        a.price.default = a.ClassPrice + a.price.dropCharge; //차량원가
        a.price.preCharge = preChargeCalc(a); //예약금
        a.price.total = a.price.default + a.price.preCharge;
        a.UseDayOrTime = transDays(a.UseDayOrTime, 'ko')

        if (a.SupplierID == 10) { //토요타
            a.SupplierName = '토요타렌트카';
            a.logoImg = 'TOYOTA'
            a.price.safeSeat = [1100, 1100, 550];
        }
        if (a.SupplierID == 19) { //후지
            a.SupplierName = '후지렌트카';
            a.logoImg = 'FUJI'
            a.price.safeSeat = [1100, 1100, 550];
        }
        if (a.SupplierID == 13) { //타임즈
            a.SupplierName = '제이넷렌트카';
            a.logoImg = 'JNET'
            a.price.safeSeat = [1100, 1100, 550];
        }
        if (a.SupplierID == 11) { //닛폰
            a.SupplierName = '닛폰렌트카';
            a.logoImg = 'NIPPON'
            a.price.safeSeat = [550, 550, 550];
        }
        if (a.SupplierID == 7) { //타임즈
            a.SupplierName = '타임즈렌트카';
            a.logoImg = 'TIMES'
            a.price.safeSeat = [1100, 1100, 550];
        }
        if (a.SupplierID == 8) { //오릭스 
            a.SupplierName = '오릭스렌트카';
            a.logoImg = 'ORIX';
            a.price.safeSeat = [1100, 1100, 1100]
        }
        if (a.SupplierID == 47) { //유니버스
            a.SupplierName = '유니버스렌트카';
            a.logoImg = 'UNIVERSE'
            a.price.safeSeat = [2200, 2200, 550];
        } else {
            // a.price.preCharge = (1500 * calculateDays(a.UseDayOrTime)); //예약금
        }
        a.carType_ko = Translate_CarType(a.CarType);
        if (a.ClassName.includes('同クラス') || a.ClassName.includes('クラス')) {
            a.ClassTag = '동급 차량';
        } else {
            a.ClassTag = '지정';
        }
        a.ClassName = Translate_ClassName(a.ClassName, 'ko');
        a.carrier = get_carrier(a.ClassName);
        a.cc = get_cc(a.ClassName);

        a.options = [];
        if (a.Class_Info_Comment.includes('バックモニター')) {
            a.options.push('후방모니터');
        }
        if (a.Class_Info_Comment.includes('Bluetooth')) {
            a.options.push('블루투스');
        }
        if (a.Class_Info_Comment.includes('新車2年以内')) {
            a.options.push('2년 이내 신차');
        }
        if (a.Class_Info_Comment.includes('ドライブレコーダー')) {
            a.options.push('블랙박스장착');
        }
        if (a.Class_Info_Comment.includes('ガソリン満タン返却不要')) {
            a.options.push('반납시 기름완충 불필요');
        }
        if (a.SupplierID == 47) {
            a.options.push('최상위보험 포함');
        }
        a.stock = a.DepartureClassOffices[0].OfficeStock

        delete a.DepartureClassOffices;
        delete a.ClassPrice;
        delete a.Class_Info_Comment_detail;
        delete a.Class_Info_Comment;

        return a;
    })
    // res.json(pricesResult)
    const NamedResult = pricesResult.filter(a => a.ClassName.length !== 0)
    const sortedResult = NamedResult.sort((a, b) => a.price.total - b.price.total)

    await browser.close();
    // return sortedResult;
    return {
        statusCode: 200,
        body: JSON.stringify({
            status: 'Ok',
            data: sortedResult
        }),
        headers: {
            "access-control-allow-origin": "*",
        },
    };
}