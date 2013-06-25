<?php

$worker= new GearmanWorker();
$worker->addServer();
$worker->addFunction('reverse', 'my_reverse_function');
while ($worker->work());

function my_reverse_function($job) {
    $max = 5;
    $rslt = strrev($job->workload());
    print('handle=' . $job->handle() . "\n");

    for ($i = 0; $i < $max; $i ++) {
        sleep(1);
        //if ($i > 0) { echo 'XXX'; $job->sendComplete($rslt); }
        print('i=' . $i . "\n");
        $job->sendStatus($i + 1, $max);
    }
    $job->sendComplete($rslt);

    return $rslt;
}

?>