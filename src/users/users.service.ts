import { HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PaginationDTO } from 'src/common/dto/common.dto';
import { PaginationEnum } from 'src/common/constants/constants.enum';
import { InjectModel } from '@nestjs/mongoose';
import { User } from './entities/user.entity';
import { Model } from 'mongoose';
import { UserDocument } from 'src/profile/schemas/user.schema';
import { ObjectId } from 'mongodb';


@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel('Role') private readonly rolesModel: Model<any>,

  ) { }

  async create(createUserDto: CreateUserDto) {
    const users = new this.userModel(createUserDto)
    return await users.save();
  }

  async findAll(PaginationDTO: PaginationDTO): Promise<any> {
    const offset = PaginationDTO.offset
      ? Number(PaginationDTO.offset)
      : PaginationEnum.OFFSET;
    const limit = PaginationDTO.limit
      ? Number(PaginationDTO.limit)
      : PaginationEnum.LIMIT;

    const options: any = {};
    // const status =
    //   PaginationDTO.invoice_status != null && Number(PaginationDTO.invoice_status) != 0
    //     ? Number(PaginationDTO.invoice_status)
    //     : null;
    // Object.assign(options, {
    //   ...(status === null ? { status: { $ne: null } } : { status: status }),
    // });
    const search = PaginationDTO.search ? PaginationDTO.search.trim() : null;
    if (search) {
      const searchRegex = new RegExp(search, "i");
      options.$or = [{ "firstName": searchRegex }, { "lastName": searchRegex }, { "email": searchRegex },];
    }

    console.log(options)
    const count = await this.userModel.find(options).countDocuments();
    const result = await this.userModel.find(options)
    .populate({ path: 'role', select: 'name' })
    .skip(offset).limit(limit)
    .sort({ createdAt: -1 })
    .lean<any>()

    return {
      result,
      pagination: {
        offset: offset,
        limit: limit,
        total: count,
      },
    };
  }

  async findOne(id: any): Promise<any> {
    const result = await this.userModel.findById(id).populate({ path: 'role', select: 'name' });

    if (!result) {
      throw new NotFoundException(`User data with ID ${id} not found.`);
    }
    return result
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const existingUser = await this.userModel.findById(id);
    if (!existingUser) {
      throw new NotFoundException(`User data with ID ${id} not found.`);
    }

    const updatedUserData = await this.userModel.findByIdAndUpdate(
      id,
      { $set: updateUserDto },
      { new: true }
    );

    return updatedUserData;
  }

  async getPermissionsUsingAccessToken(ID: any) {
    try {
     const user = await this.userModel.findById('67dbc1d822ab7b13fdf71a4b')
      if (!user) {
        throw new HttpException(
          'User with this id does not exist',
          HttpStatus.NOT_FOUND
        )
      }
      const roles = await this.rolesModel.findOne({
        _id: user.role,
        isActive: true
      })
      console.log(user.role)
      // If roles not active the array becomes empty.
      if (!roles) {
        return []
      }
      const aggregateOptions = [
        {
          $match: {
            _id: user.role
          }
        },
        {
          $project: {
            permissions: 1,
            name: 1
          }
        },
        {
          $addFields: {
            roles: {
              $map: {
                input: '$permissions',
                as: 'el',
                in: {
                  $map: {
                    input: {
                      $objectToArray: '$$el'
                    },
                    as: 'item',
                    in: {
                      $cond: {
                        if: {
                          $eq: ['$$item.v', true]
                        },
                        then: {
                          $concat: [
                            {
                              $first: {
                                $split: [
                                  {
                                    $toLower: '$$el.name'
                                  },
                                  ' '
                                ]
                              }
                            },
                            '.',
                            '$$item.k'
                          ]
                        },
                        else: null
                      }
                    }
                  }
                }
              }
            }
          }
        },
        {
          $addFields: {
            permissions: {
              $filter: {
                input: {
                  $reduce: {
                    input: '$roles',
                    initialValue: [],
                    in: {
                      $concatArrays: ['$$value', '$$this']
                    }
                  }
                },
                as: 'role',
                cond: {
                  $ne: ['$$role', null]
                }
              }
            }
          }
        }
      ]
      const role = await this.rolesModel.aggregate(aggregateOptions).exec()

      return role[0].permissions
    } catch (e) {
      throw new HttpException(e, HttpStatus.UNAUTHORIZED);
    }
  }
  async removeTrailingHyphens(str) {
    while (str.endsWith('-')) {
      str = str.slice(0, -1);
    }
    return str;
  }

}
