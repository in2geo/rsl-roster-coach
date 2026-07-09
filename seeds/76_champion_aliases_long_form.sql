-- ============================================================================
-- 76 — champion_aliases: long-form aliases (reverse of seed 28).
--      For champions whose canonical champions.name is the SHORT form, register
--      the long/epithet form as a long_name alias so name-keyed TEXT sources
--      (e.g. 'Avir the Alchemage') resolve to the canonical champion ('Avir').
--      source='long_name'. Idempotent (ON CONFLICT DO NOTHING on lower(alias)).
--      Derived from master full name vs live short name (269 rows).
-- ============================================================================

insert into champion_aliases (champion_id, alias, source)
select id, 'Acelin the Stalwart', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Acelin' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Achak the Wendarin', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Achak' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Aeila Lifebraid', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Aeila' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Akoth the Seared', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Akoth' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Alaric the Hooded', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Alaric' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Alaz the Sunbearer', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Alaz' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Aleksandr the Sharpshooter', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Aleksandr' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Alice the Wanderer', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Alice' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Alsgor Crimsonhorn', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Alsgor' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Amoch the First Satrap', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Amoch' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Anaxia the Reborn', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Anaxia' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Androc the Glorious', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Androc' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Aox the Rememberer', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Aox' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Aphidus the Hivelord', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Aphidus' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'April ONeil', 'long_name' from champions
where game_id='raid_shadow_legends' and name='April' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Arachoa Moonspinner', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Arachoa' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Aragaz Wyldking', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Aragaz' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Arashi the Riptide', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Arashi' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Aratheia Corpseflower', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Aratheia' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Arbais the Stonethorn', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Arbais' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Armanz the Magnificent', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Armanz' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Arne the White', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Arne' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Arnorn the Shining', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Arnorn' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Arwydd Quivergrass', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Arwydd' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Avir the Alchemage', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Avir' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Baerd the Broad', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Baerd' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Baerdal Fellhammer', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Baerdal' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Balar the Lost', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Balar' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Balthus Drauglord', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Balthus' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Bambus Fourleaf', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Bambus' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Baroth the Bloodsoaked', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Baroth' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Basim Ibn Ishaq', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Basim' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Belletar Mage Slayer', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Belletar' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Belz the Reckoner', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Belz' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Bergoth the Malformed', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Bergoth' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Bivald of the Thorn', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Bivald' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Blizaar the Howler', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Blizaar' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Bolint Freewalker', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Bolint' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Boragar the Elder', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Boragar' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Bovos Sharphorn', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Bovos' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Bowf the Rancid', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Bowf' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Brakus the Shifter', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Brakus' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Caoilte the Asharrow', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Caoilte' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Cecilia the Red Hope', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Cecilia' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Chalco the Blind', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Chalco' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Cheshire Cat', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Cheshire' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Cillian the Lucky', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Cillian' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Cinda Forgeheart', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Cinda' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Cormac the Highpeak', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Cormac' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Craklin the Blackened', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Craklin' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Cromax Moonblood', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Cromax' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Danag Skullreap', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Danag' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Denid the Tusk Knight', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Denid' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Dhukk the Pierced', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Dhukk' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Diamant Coppercoin', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Diamant' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Dolor Lorekeeper', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Dolor' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Drokgul the Gaunt', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Drokgul' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Duedan the Runic', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Duedan' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Duhr the Hungerer', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Duhr' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Dyana Gloompiercer', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Dyana' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Edward Kenway', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Edward' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Elva Autumnborn', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Elva' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Embrys the Anomaly', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Embrys' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Emic Trunkheart', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Emic' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Enda Moonbeam', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Enda' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Eostrid Dreamsong', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Eostrid' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Esme the Dancer', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Esme' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Ethlen the Golden', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Ethlen' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Falmond Mournsword', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Falmond' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Firrol the Barkhorn', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Firrol' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Fjorad Wolfheart', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Fjorad' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Freyja Fateweaver', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Freyja' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Frolni the Mechanist', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Frolni' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Fyna Blade of Aravia', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Fyna' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Gaellut Son of the Pact', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Gaellut' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Gaius the Gleeful', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Gaius' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Gala Longbraids', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Gala' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Galapo the Recluse', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Galapo' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Galleus Bloodcrest', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Galleus' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Gaspard the Accused', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Gaspard' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Genbo the Dishonored', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Genbo' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Georgid the Breaker', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Georgid' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Gerhard the Stone', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Gerhard' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Gharol Bloodmaul', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Gharol' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Ghomm Yellowhand', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Ghomm' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Ghrush the Mangler', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Ghrush' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Giath the Truthshield', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Giath' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Ginro the Stork', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Ginro' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Giscard the Sigiled', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Giscard' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Gizmak the Terrible', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Gizmak' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Glaicad of the Meltwater', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Glaicad' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Gliseah Soulguide', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Gliseah' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Gloril Brutebane', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Gloril' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Gnarox Blackhorn', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Gnarox' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Goffred Brassclad', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Goffred' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Gomlok Skyhide', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Gomlok' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Gorlos Hellmaw', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Gorlos' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Graazur Irongut', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Graazur' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Granyt Doorkeep', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Granyt' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Gravechill Killer', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Gravechill' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Gretel Hagbane', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Gretel' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Grohak the Bloodied', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Grohak' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Grugtha Darkseer', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Grugtha' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Grunch Killjoy', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Grunch' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Gurgoh the Augur', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Gurgoh' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Gurptuk Moss-Beard', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Gurptuk' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Guurda Bogbrew', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Guurda' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Gwyndolin the Silent', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Gwyndolin' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Haarken Greatblade', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Haarken' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Hakkorhn Smashlord', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Hakkorhn' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Hansel Witchhunter', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Hansel' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Hellborn Sprite', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Hellborn' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Hilda Arnorndottr', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Hilda' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Hilvi the Rime Called', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Hilvi' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Hoforees the Tusked', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Hoforees' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Ingid Twyst-staff', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Ingid' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Inithwe Bloodtwin', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Inithwe' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Ishiyama the Immovable', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Ishiyama' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Jagg Bonesaw', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Jagg' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Jetni the Giant', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Jetni' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Joan the Luminant', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Joan' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Kaja the Wry', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Kaja' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Kantra the Cyclone', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Kantra' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Karato Foxhunter', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Karato' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Karilon the Ringer', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Karilon' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Karnage the Anarch', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Karnage' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Kawn Branchbreaker', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Kawn' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Keberon the Underflame', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Keberon' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Keeyra the Watcher', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Keeyra' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Kellan the Shrike', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Kellan' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Kerin the Harvester', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Kerin' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Khafru the Deathkeeper', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Khafru' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Klaazag Keyhulk', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Klaazag' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Klodd Beastfeeder', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Klodd' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Knave of Hearts', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Knave' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Knosson the Bronze Bull', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Knosson' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Komidus Darksmile', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Komidus' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Konstantin the Dayborn', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Konstantin' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Korugar Death-Bell', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Korugar' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Kosk of Two Skins', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Kosk' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Kreela Witch-Arm', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Kreela' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Krisk the Ageless', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Krisk' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Kroz Wallbreaker', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Kroz' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Kurosa the Covetous', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Kurosa' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Kurzad Deepheart', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Kurzad' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Leminisi the Gold Wing', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Leminisi' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Leorius the Proud', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Leorius' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Lodric Falconheart', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Lodric' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Loki the Deceiver', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Loki' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Lorn the Cutter', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Lorn' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Lugan the Steadfast', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Lugan' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Lydia the Deathsiren', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Lydia' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Lysanthir Beastbane', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Lysanthir' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Maddak Eyes of Skyiron', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Maddak' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Malkith Bloodflock', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Malkith' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Margrave Greenhawk', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Margrave' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Marichka the Unbreakable', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Marichka' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Masahiro the Bell Monk', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Masahiro' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Mathias Blackflail', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Mathias' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Maulie Tankard', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Maulie' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Melga Steelgirdle', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Melga' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Mezomel Luperfang', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Mezomel' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Mistress of Hymns', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Mistress' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Mithrala Lifebane', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Mithrala' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Modo of the Peal', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Modo' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Nais the Shadowthief', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Nais' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Nari the Lucky', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Nari' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Nekhret the Great', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Nekhret' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Neldor Rimeblade', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Neldor' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Nell Blackteeth', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Nell' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Niamhe Spear of Nyresa', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Niamhe' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Noct the Paralyzer', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Noct' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Nogdar the Headhunter', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Nogdar' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Noldua the Gloaming', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Noldua' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Odin Faefather', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Odin' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Opardin Clanfather', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Opardin' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Osgrun the Defiler', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Osgrun' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Ostrox Boneglaive', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Ostrox' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Pann the Bowhorn', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Pann' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Pelagus the Wavewalker', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Pelagus' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Petrifya Rockroot', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Petrifya' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Pharsalas Gravedirt', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Pharsalas' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Pheidi Tealcrest', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Pheidi' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Phemo the Shepherd', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Phemo' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Polara Fireheart', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Polara' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Praeva the Slitherer', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Praeva' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Quintus the Triumphant', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Quintus' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Rakka Viletide', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Rakka' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Ramantu Drakesblood', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Ramantu' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Rhaia the Mourned', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Rhaia' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Rhazin Scarhide', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Rhazin' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Rian the Conjurer', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Rian' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Riho Bonespear', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Riho' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Roric Wyrmbane', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Roric' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Roshcard the Tower', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Roshcard' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Rotos the Lost Groom', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Rotos' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Ruel the Huntmaster', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Ruel' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Rugnor Goldgleam', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Rugnor' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Samar Gemcursed', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Samar' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Samson the Masher', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Samson' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Searsha the Charred', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Searsha' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Selinia Nightcloak', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Selinia' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Senna Amberheart', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Senna' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Shu-Zhen the Valorous', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Shu-Zhen' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Sicia Flametongue', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Sicia' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Siegfrund the Nephilim', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Siegfrund' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Sigmund the Highshield', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Sigmund' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Signy of Highshield', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Signy' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Silvain the Paramour', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Silvain' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Siphi the Lost Bride', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Siphi' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Skimfos the Consumed', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Skimfos' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Skorid the Halfspawn', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Skorid' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Slixus Stripehide', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Slixus' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Solanar the Gleaming', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Solanar' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Stokk the Broken', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Stokk' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Suwai Firstborn', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Suwai' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Sydax King Killer', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Sydax' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Tainix Hateflower', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Tainix' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Talenna Soulseer', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Talenna' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Taras the Fierce', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Taras' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Tatura Rimehide', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Tatura' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Teela Goremane', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Teela' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Tekteon Fissureflesh', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Tekteon' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Teryx the Restless', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Teryx' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Tetsuya the Deliverer', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Tetsuya' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Thea the Tomb Angel', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Thea' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Theodosia the Disgraced', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Theodosia' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Thor Faehammer', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Thor' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Thorn Golem', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Thorn' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Timit the Fool', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Timit' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Titus Blackplume', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Titus' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Togron the Conjoined', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Togron' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Tolf the Maimed', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Tolf' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Toragi the Frog', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Toragi' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Tormin the Cold', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Tormin' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Toshiro the Bloody', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Toshiro' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Trunda Giltmallet', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Trunda' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Tuhak the Wanderer', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Tuhak' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Twinclaw Disciple', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Twinclaw' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Ugir the Wyrmeater', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Ugir' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Ultan of the Shell', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Ultan' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Urost the Soulcage', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Urost' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Ursala the Mourner', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Ursala' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Ursuga Warcaller', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Ursuga' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Uzol of the Jade', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Uzol' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Varkos Headsplitter', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Varkos' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Varl the Destroyer', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Varl' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Vasal of the Seal', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Vasal' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Venalicia Thrallmother', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Venalicia' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Versulf the Grim', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Versulf' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Vestele Riverthorn', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Vestele' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Visix the Unbowed', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Visix' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Vitrius the Anointed', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Vitrius' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Vizug the Noxious', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Vizug' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Vlad the Nightborn', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Vlad' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Vulkanos Fumor', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Vulkanos' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Weregren Suncursed', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Weregren' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Wurlim Frostking', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Wurlim' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Wysteri Vineguard', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Wysteri' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Wythir the Crowned', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Wythir' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Xena Warrior Princess', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Xena' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Xiloco the Encrusted', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Xiloco' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Yaga the Insatiable', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Yaga' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Yakarl the Scourge', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Yakarl' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Yncensa Grail-bearer', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Yncensa' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Yoshi the Drunkard', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Yoshi' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Yukimasa Demon of Ice', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Yukimasa' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Yuzan the Marooned', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Yuzan' on conflict do nothing;
insert into champion_aliases (champion_id, alias, source)
select id, 'Zii Ixchi', 'long_name' from champions
where game_id='raid_shadow_legends' and name='Zii' on conflict do nothing;
