#!/usr/bin/ruby
# encoding: utf-8

require 'gearman'

worker = Gearman::Worker.new(['localhost'])


worker.add_ability('reverse') do |data,job|
  result = data.force_encoding('UTF-8').reverse
  puts "reverse: job = #{job.inspect}, data = #{data}"
  result
end


worker.add_ability('sleep') do |data,job|
  seconds = data
  (1..seconds.to_i).each do |i|
    sleep 1
    puts "sleep: job = #{job.inspect}, idx = #{i}"
    job.report_status(i, seconds)
  end
  "done, seconds = #{seconds}"
end
loop { worker.work }
