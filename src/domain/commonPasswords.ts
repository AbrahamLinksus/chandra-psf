/**
 * Vendored list of very common passwords (SPEC US-28). Only entries of MIN_PASSWORD_LENGTH or more
 * matter: shorter ones are already rejected as too short. Lower-case; compared case-insensitively.
 */
const LISTED = `
password passw0rd p@ssword p@ssw0rd password1 password12 password123 password1234 password12345
12345678 123456789 1234567890 12345678910 123123123 1234512345 11111111 111111111 1111111111
00000000 000000000 0000000000 22222222 33333333 44444444 55555555 66666666 77777777 88888888 99999999
87654321 987654321 9876543210 123454321 12341234 12121212 11223344 1q2w3e4r 1q2w3e4r5t 1qaz2wsx
1qaz2wsx3edc 1qazxsw2 qwertyui qwertyuiop qwerty123 qwerty1234 qwerty12345 qwertyuiop123 qwerty12
asdfghjk asdfghjkl asdfgh123 asdf1234 asdfasdf zxcvbnm1 zxcvbnm123 zxcvbnmasdf
qazwsxedc qazwsx123 qwe12345 qwe123qwe qweasdzxc q1w2e3r4 q1w2e3r4t5 1qazxsw23edc zaq12wsx
abcd1234 abcdefgh abcdefg1 abcdefgh1 abc12345 abc123456 abcd12345 abcdefghi abcdefghij
iloveyou iloveyou1 iloveyou2 iloveyou123 iloveyou12 iloveu123 ilovemom ilovedad ilovegod
princess princess1 princess123 sunshine sunshine1 superman superman1 batman123 spiderman
football football1 football123 baseball baseball1 basketball cricket123 cricket1 soccer123
trustno1 letmein1 letmein123 welcome1 welcome12 welcome123 welcome1234 welcome@123 welcome#1
administrator admin123 admin1234 admin12345 admin@123 admin@1234 admin#123 admin123456 administrator1
adminadmin root1234 rootroot toor1234 changeme changeme1 changeme123 change123 default1 default123
test1234 test12345 testtest testing1 testing123 test@123 guest123 guest1234 user1234 username
mypassword mypassword1 mypass123 mypassw0rd yourpassword newpassword newpass123 secret123 secret12
passpass passpass1 pass1234 pass12345 pass@123 pass@1234 passw0rd1 passw0rd123 pa55word pa55w0rd
monkey123 monkey12 dragon123 dragon12 master123 master12 shadow123 shadow12 michael1 jennifer
jordan23 jordan123 hunter12 hunter123 harley123 ranger12 buster12 thomas123 charlie1 charlie123
daniel123 andrew123 joshua123 matthew1 jessica1 ashley123 nicole123 hannah123 samantha tigger123
liverpool arsenal1 chelsea1 manutd11 barcelona realmadrid mercedes porsche911 ferrari1 corvette
starwars starwars1 pokemon1 pokemon123 minecraft minecraft1 fortnite1 computer computer1 internet
internet1 whatever whatever1 freedom1 flower123 butterfly sweetheart blessed1 blessing1 jesus123
mustang1 mustang12 maverick1 yankees1 steelers cowboys1 lakers24 dolphins redskins1 patriots
summer12 summer123 summer2020 summer2021 summer2022 summer2023 summer2024 summer2025 summer2026
winter12 winter123 spring123 autumn123 january1 february1 december1 november1 october1 september1
monday123 friday123 sunday123 holiday1 america1 england1 canada123 london123 newyork1 chicago1
india123 india1234 india@123 india2020 india2024 india2025 india2026 bharat123 bharat@123 jaihind1
chennai123 chennai@123 chennai1 madras123 mumbai123 mumbai@123 delhi123 delhi@123 bangalore
bangalore1 bangalore123 hyderabad kolkata1 kolkata123 pune1234 tamilnadu tamilnadu1 tamil123
honda123 honda1234 honda@123 hondaactiva activa123 activa@123 hero1234 bajaj123 tvs12345 yamaha123
chandra123 chandra1234 chandra@123 chandrahonda chandra@1234 chandra#123 service123 service@123
feedback1 feedback123 feedback@123 support123 support1234 support@123 support@1234 branch123
manager123 manager1234 manager@123 mainadmin1 branchadmin staff1234 staff@123 office123 office@123
ganesh123 ganesh@123 krishna123 krishna@123 murugan123 murugan@123 shiva1234 sivasiva1 saravana1
lakshmi123 lakshmi@123 sathya123 ramesh123 ramesh@123 suresh123 suresh@123 kumar1234 kumar@123
kumar12345 priya1234 priya@123 arun12345 arun@123 vijay1234 vijay@123 rajini123 rajesh123 rajesh@123
sachin123 sachin10 dhoni1234 dhoni0701 kohli1818 virat1818 rohit1234 raju12345 ravi12345 ravi@123
anitha123 deepa1234 divya1234 kavitha123 sandhya123 sundar123 sundar@123 venkat123 venkatesh
mohan1234 mohan@123 abcd@123 abcd@1234 abc@1234 abc@12345 abc#1234 qwerty@123 qwerty@1234 qwerty#123
asdf@123 asdf@1234 zxcv@123 pass#123 pass#1234 test#123 india#123 hello@123 hello123 hello1234
hello12345 helloworld helloworld1 iloveindia ilovechennai myindia123 password@123
password@1234 password#123 password#1 password!1 password!123 password1! password123! password2
password3 password01 password02 password11 password99 password00 passwords passwords1 passw0rd!
p@$$w0rd p@ssw0rd1 p@ssw0rd123 p@55w0rd p@ssword1 p@ssword123 letmein12 letmein1234
login123 login1234 logmein1 access123 access14 enter123 enter1234 open1234 opensesame mysecret
secret1234 sesame123 masterkey nothing1 nopassword noway123 anything1 something1 everything
blahblah blahblah1 foobar12 foobar123 foobarbaz qwertzui qwertyas qweasdzx qweqweqwe qwqwqwqw
aaaaaaaa aaaaaaaa1 aaaa1111 aaaabbbb aabbccdd aabb1122 abababab abcabcabc abcabc123 abc123abc
a1b2c3d4 a1b2c3d4e5 a1s2d3f4 a1s2d3f4g5 z1x2c3v4 1a2b3c4d 1a2b3c4d5e 1z2x3c4v 1qw23er4
12qwaszx 123qweasd 123qwe123 123qweasdzxc 123abc123 123abcabc 123456abc
123456qwe 123456qwerty 1234qwer 1234qwerty 1234abcd 1234asdf
12345qwert 12345qwerty 12345abcde 12345678a 12345678q 12345678! 12345678@
123456789a 123456789q 123456789! 123456789@ 123456789* 12345678aa
123456123456 123456654321 123321123 1234554321 112233445566 1122334455 11112222 1111aaaa 11111aaaaa
147258369 147852369 159753159 159357159 741852963 963852741 789456123 456789123 321654987 258369147
135792468 246813579 1357924680 2468013579 0987654321 09876543 0123456789 01234567 012345678 1029384756
0192837465 1357908642 142536789 1234567891 1234567899 1234567812 1234567800 123456789012 1234567890123
20202020 20212021 20222022 20232023 20242024 20252025 20262026 2020abcd 2021abcd 2022abcd 2023abcd
19801980 19901990 19851985 19951995 19961996 19971997 19981998 19991999 20002000 20012001 20102010
01011990 01011980 01012000 01012001 01011985 01011995 01012020 01012024 01012025 01012026 10101010
`;

const WORDS = [
  "password",
  "welcome",
  "admin",
  "letmein",
  "qwerty",
  "india",
  "chennai",
  "honda",
  "chandra",
  "service",
  "dragon",
  "monkey",
  "master",
  "login",
  "secret",
  "sunshine",
  "princess",
  "football",
  "iloveyou",
  "shadow",
  "superman",
  "michael",
  "freedom",
  "whatever",
  "trustno1",
  "abc",
  "hello",
];
const SUFFIXES = [
  "123",
  "1234",
  "12345",
  "123456",
  "@123",
  "@1234",
  "#123",
  "!",
  "1",
  "12",
  "01",
  "007",
  "786",
  "2020",
  "2021",
  "2022",
  "2023",
  "2024",
  "2025",
  "2026",
  "@2024",
  "@2025",
  "@2026",
];

function build(): ReadonlySet<string> {
  const all = new Set<string>(LISTED.split(/\s+/).filter((w) => w.length > 0));
  for (const w of WORDS) for (const s of SUFFIXES) all.add(w + s);
  return all;
}

export const COMMON_PASSWORDS: ReadonlySet<string> = build();
