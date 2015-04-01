<?php

$worker= new GearmanWorker();
$worker->addServer();

$c = 0;
$worker->addFunction("cnt", function ($job) use (&$c) {
    $c++;
    print("job {$c}\n");
    return $c;
});

$onek = str_pad('', 1024);
$worker->addFunction("1K", function ($job) use ($onek) {
    print("job 1K\n");
    return $onek;
});

$tenk = str_pad('', 1024*10);
$worker->addFunction("10K", function ($job) use ($tenk) {
    print("job 10K\n");
    return $tenk;
});

$hundredk = str_pad('', 1024*100);
$worker->addFunction("100K", function ($job) use ($hundredk) {
    print("job 100K\n");
    return $hundredk;
});

$onem = str_pad('', 1024*1024);
$worker->addFunction("1M", function ($job) use ($onem) {
    print("job 1M\n");
    return $onem;
});

while ($worker->work()) {
    continue;
}